import type {
  ExecutionContext,
  ScheduledController,
} from "@cloudflare/workers-types";
import { LIMITS } from "@lexiro/ai-contract";
import {
  AuthenticationError,
  isAdministrator,
  verifyFirebaseToken,
} from "./auth";
import {
  account,
  BillingError,
  ensureAccount,
  ownsCursor,
  reserve,
  scheduledMaintenance,
  settle,
} from "./billing";
import { adminRequest } from "./admin";
import { HttpError, readBody } from "./http";
import { MODELS, prepareGeneration, upstreamBody } from "./generation";
import { prepareImage } from "./organize";
import { sanitizeResponseStream } from "./response-stream";
import { settleGeneration } from "./settlement";
import type { Env } from "./env";

/**
 * `ALLOWED_ORIGIN` is the complete list, comma separated. A development origin
 * is one entry a developer adds to their own configuration, not a permanent
 * hole that ships to production because localhost is convenient.
 */
export function allowedOrigin(origin: string, allowed: string): boolean {
  if (!origin) return false;
  return allowed
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .includes(origin);
}

export function createWorker(
  verify = verifyFirebaseToken,
  fetcher: typeof fetch = fetch,
) {
  return {
    async fetch(
      request: Request,
      env: Env,
      ctx: ExecutionContext,
    ): Promise<Response> {
      const origin = request.headers.get("origin");
      const cors: Record<string, string> = {
        "cache-control": "no-store",
        vary: "Origin",
        ...(origin && allowedOrigin(origin, env.ALLOWED_ORIGIN)
          ? { "access-control-allow-origin": origin }
          : {}),
        "access-control-allow-headers":
          "Authorization, Content-Type, X-Session-Id",
        "access-control-allow-methods": "GET, POST, PATCH, OPTIONS",
        "access-control-expose-headers": "X-Context-Rebuilt, Retry-After",
      };
      const decorate = (response: Response) => {
        const headers = new Headers(response.headers);
        for (const [key, value] of Object.entries(cors))
          headers.set(key, value);
        return new Response(response.body, {
          status: response.status,
          headers,
        });
      };
      try {
        if (origin && !allowedOrigin(origin, env.ALLOWED_ORIGIN))
          throw new HttpError(403, "forbidden_origin");
        if (request.method === "OPTIONS")
          return new Response(null, { status: 204, headers: cors });
        const identity = await verify(request, env.FIREBASE_PROJECT_ID);
        const admin = isAdministrator(identity, env.ADMIN_EMAILS);
        const path = new URL(request.url).pathname;
        if (path.startsWith("/admin/")) {
          if (!admin) throw new HttpError(404, "not_found");
          return decorate(await adminRequest(request, env, path));
        }
        await ensureAccount(env.DB, identity.uid, identity.email);
        if (path === "/me" && request.method === "GET") {
          const user = await account(env.DB, identity.uid);
          return decorate(
            Response.json({
              points: Math.max(0, user?.points ?? 0),
              monthly: user?.monthly ?? 0,
              renews_at: user?.monthly ? user.renews_at : null,
              admin,
            }),
          );
        }
        if (
          !["/generate", "/organize"].includes(path) ||
          request.method !== "POST"
        )
          throw new HttpError(404, "not_found");
        const image =
          path === "/organize" &&
          request.headers.get("content-type")?.split(";")[0] === "text/plain";
        const prepared = image
          ? await prepareImage(
              await readBody(request, LIMITS.bodyBytes),
              request.headers.get("x-session-id"),
              identity.uid,
            )
          : await prepareGeneration(
              JSON.parse(await readBody(request, 100_000)),
              identity.uid,
            );
        if (
          (path === "/organize") !==
          ["organizeText", "organizeImage"].includes(prepared.request.kind)
        )
          throw new HttpError(400, "invalid_input");
        // An administrator holds no balance, no lock and no retry budget: the
        // run still settles so its cursor and token usage are recorded.
        const reservation = admin
          ? { uid: identity.uid, attempt: crypto.randomUUID(), charges: [] }
          : await reserve(
              env.DB,
              identity.uid,
              prepared.units,
              prepared.halfRate,
            );
        const model = MODELS[prepared.request.tier].model;
        try {
          let cursor =
            prepared.request.cursor &&
            (await ownsCursor(env.DB, identity.uid, prepared.request.cursor))
              ? prepared.request.cursor
              : undefined;
          const signal = AbortSignal.any([
            request.signal,
            AbortSignal.timeout(110_000),
          ]);
          const send = () =>
            fetcher(`${env.OPENAI_BASE_URL}/responses`, {
              method: "POST",
              headers: {
                authorization: `Bearer ${env.OPENAI_API_KEY}`,
                "content-type": "application/json",
              },
              body: upstreamBody(prepared, cursor),
              signal,
            });
          let response = await send();
          if (cursor && (response.status === 400 || response.status === 404)) {
            const detail: unknown = await response.json();
            if (
              detail &&
              typeof detail === "object" &&
              "error" in detail &&
              detail.error &&
              typeof detail.error === "object" &&
              "param" in detail.error &&
              detail.error.param === "previous_response_id"
            ) {
              cursor = undefined;
              response = await send();
            }
          }
          if (!response.ok || !response.body) {
            await response.body?.cancel();
            throw new HttpError(
              response.status === 429
                ? 429
                : response.status >= 500
                  ? 503
                  : 500,
              "upstream_unavailable",
              undefined,
              response.headers.get("retry-after") ?? undefined,
            );
          }
          const finished = Promise.withResolvers<void>();
          ctx.waitUntil(finished.promise);
          // A run that never reached a terminal event still cost tokens. The
          // stored response is the only remaining record of how many.
          const recoverUsage = async (id: string) => {
            const stored = await fetcher(
              `${env.OPENAI_BASE_URL}/responses/${encodeURIComponent(id)}`,
              {
                headers: { authorization: `Bearer ${env.OPENAI_API_KEY}` },
                signal: AbortSignal.timeout(10_000),
              },
            );
            if (!stored.ok) {
              await stored.body?.cancel();
              return undefined;
            }
            const detail: unknown = await stored.json();
            return detail && typeof detail === "object"
              ? (detail as Record<string, unknown>)
              : undefined;
          };
          const body = sanitizeResponseStream(response.body, {
            onTerminal: async (terminal) => {
              try {
                const credits = await settleGeneration(
                  env.DB,
                  reservation,
                  prepared,
                  terminal,
                  model,
                  recoverUsage,
                );
                finished.resolve();
                return admin ? { credits } : undefined;
              } catch (reason) {
                finished.reject(reason);
                throw reason;
              }
            },
          });
          return decorate(
            new Response(body, {
              headers: {
                "content-type": "text/event-stream",
                ...(prepared.request.cursor && !cursor
                  ? { "x-context-rebuilt": "1" }
                  : {}),
              },
            }),
          );
        } catch (reason) {
          await settle(env.DB, reservation, reservation.charges, { model }, {
            charged: 0,
            cost: 0,
            status: "failed",
            kind: prepared.request.kind,
            tier: prepared.request.tier,
            units: prepared.units.length,
          });
          throw reason;
        }
      } catch (reason) {
        const error =
          reason instanceof HttpError
            ? reason
            : reason instanceof AuthenticationError
              ? new HttpError(401, "unauthorized")
              : reason instanceof BillingError
                ? new HttpError(reason.status, reason.message)
                : reason instanceof SyntaxError
                  ? new HttpError(400, "invalid_input")
                  : new HttpError(500, "upstream_unavailable");
        return decorate(
          Response.json(
            {
              error: {
                code: error.code,
                ...(error.field ? { field: error.field } : {}),
              },
            },
            {
              status: error.status,
              headers: error.retryAfter
                ? { "retry-after": error.retryAfter }
                : {},
            },
          ),
        );
      }
    },
    async scheduled(
      _event: ScheduledController,
      env: Env,
      ctx: ExecutionContext,
    ) {
      ctx.waitUntil(scheduledMaintenance(env.DB));
    },
  };
}

export default createWorker();

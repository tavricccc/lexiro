import type {
  ExecutionContext,
  ScheduledController,
} from "@cloudflare/workers-types";
import { LIMITS, QUESTION_KINDS, QUESTION_GENERATION_CONTRACT } from "@lexiro/ai-contract";
import {
  AuthenticationError,
  isAdministrator,
  verifyFirebaseToken,
} from "./auth";
import {
  account,
  BillingError,
  ensureAccount,
  scheduledMaintenance,
} from "./billing";
import { adminRequest } from "./admin";
import { checkAppCheck } from "./app-check";
import { HttpError, readBody } from "./http";
import { prepareGeneration } from "./generation";
import { UpstreamError } from "./upstream-error";
import { prepareImages } from "./organize";
import { createUsageRecovery, reconcileUsage } from "./usage-recovery";
import type { Env } from "./env";
export { GenerationRoom } from "./generation-room";
type RoomFetcher = (uid: string, session: string) => { fetch(request: Request): Promise<Response> };

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
  rooms?: RoomFetcher,
) {
  return {
    async fetch(
      request: Request,
      env: Env,
      _ctx: ExecutionContext,
    ): Promise<Response> {
      const origin = request.headers.get("origin");
      const cors: Record<string, string> = {
        "cache-control": "no-store",
        vary: "Origin",
        ...(origin && allowedOrigin(origin, env.ALLOWED_ORIGIN)
          ? { "access-control-allow-origin": origin }
          : {}),
        "access-control-allow-headers":
          "Authorization, Content-Type, X-Session-Id, X-AI-Model, X-AI-Tier, X-Question-Contract, X-Generation-Id, X-Firebase-AppCheck",
        "access-control-allow-methods": "GET, POST, PATCH, OPTIONS",
        "access-control-expose-headers": "X-Generation-Id, Retry-After",
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
      let admin = false;
      try {
        if (origin && !allowedOrigin(origin, env.ALLOWED_ORIGIN))
          throw new HttpError(403, "forbidden_origin");
        if (request.method === "OPTIONS")
          return new Response(null, { status: 204, headers: cors });
        await checkAppCheck(request, env, fetcher);
        const identity = await verify(request, env.FIREBASE_PROJECT_ID);
        admin = isAdministrator(identity, env.ADMIN_EMAILS);
        const path = new URL(request.url).pathname;
        if (path.startsWith("/admin/")) {
          if (!admin) throw new HttpError(404, "not_found");
          return decorate(await adminRequest(request, env, path));
        }
        await ensureAccount(env.DB, identity.uid, identity.email);
        const recoverUsage = createUsageRecovery(env, fetcher);
        await reconcileUsage(env.DB, recoverUsage, identity.uid);
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
        const room = (session: string): ReturnType<RoomFetcher> => rooms ? rooms(identity.uid, session) : env.GENERATIONS!.get(env.GENERATIONS!.idFromName(`${identity.uid}:${session}`)) as unknown as ReturnType<RoomFetcher>;
        const resume = /^\/generation\/([0-9a-f-]{36})\/([0-9a-f-]{36})$/.exec(path);
        if (resume && request.method === "GET") return decorate(await room(resume[1]).fetch(new Request(`https://generation/${resume[2]}`)));
        if (
          !["/generate", "/organize"].includes(path) ||
          request.method !== "POST"
        )
          throw new HttpError(404, "not_found");
        const image =
          path === "/organize" &&
          request.headers.get("content-type")?.split(";")[0] === "text/plain";
        const prepared = image
          ? await prepareImages(
              await readBody(request, LIMITS.bodyBytes),
              request.headers.get("x-session-id"),
              identity.uid,
              request.headers.get("x-ai-model"),
              request.headers.get("x-ai-tier") ?? "lite",
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
        if (QUESTION_KINDS.includes(prepared.request.kind as typeof QUESTION_KINDS[number]) &&
            request.headers.get("x-question-contract") !== QUESTION_GENERATION_CONTRACT)
          throw new HttpError(426, "question_update_required");
        const jobId = request.headers.get("x-generation-id");
        if (!jobId || !/^[0-9a-f-]{36}$/.test(jobId)) throw new HttpError(426, "generation_update_required");
        return decorate(await room(prepared.request.session).fetch(new Request(`https://generation/${jobId}`, {
          method: "POST", body: JSON.stringify({ uid: identity.uid, admin, prepared }),
        })));
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
                ...(admin && reason instanceof UpstreamError ? { diagnostic: reason.diagnostic } : {}),
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
      ctx.waitUntil((async () => {
        await reconcileUsage(env.DB, createUsageRecovery(env, fetcher));
        await scheduledMaintenance(env.DB);
      })());
    },
  };
}

export default createWorker();

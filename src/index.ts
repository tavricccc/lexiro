import type { ExecutionContext, ScheduledController } from "@cloudflare/workers-types";
import { TIERS } from "@lexiro/ai-contract";
import { AuthenticationError, isAdministrator, verifyFirebaseToken } from "./auth";
import { account, BillingError, ensureTrial, ownsCursor, reserve, scheduledMaintenance, settle } from "./billing";
import { adminRequest } from "./admin";
import { HttpError, readBody } from "./http";
import { MODELS, prepareGeneration, upstreamRequest } from "./generation";
import { sanitizeResponseStream } from "./response-stream";
import { settleGeneration } from "./settlement";
import type { Env } from "./env";

export function allowedOrigin(origin: string, production: string): boolean {
  if (origin === production && origin !== "") return true;
  try { const url = new URL(origin); return ["http:", "https:"].includes(url.protocol) && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname); }
  catch { return false; }
}

export function createWorker(verify = verifyFirebaseToken, fetcher: typeof fetch = fetch) {
  return {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
      const origin = request.headers.get("origin");
      const cors: Record<string, string> = {
        "cache-control": "no-store", vary: "Origin",
        ...(origin && allowedOrigin(origin, env.ALLOWED_ORIGIN) ? { "access-control-allow-origin": origin } : {}),
        "access-control-allow-headers": "Authorization, Content-Type, X-Session-Id",
        "access-control-allow-methods": "GET, POST, PATCH, OPTIONS",
        "access-control-expose-headers": "X-Context-Rebuilt",
      };
      const decorate = (response: Response) => {
        const headers = new Headers(response.headers);
        for (const [key, value] of Object.entries(cors)) headers.set(key, value);
        return new Response(response.body, { status: response.status, headers });
      };
      try {
        if (origin && !allowedOrigin(origin, env.ALLOWED_ORIGIN)) throw new HttpError(403, "forbidden_origin");
        if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
        const identity = await verify(request, env.FIREBASE_PROJECT_ID);
        const admin = isAdministrator(identity, env.ADMIN_EMAILS);
        const path = new URL(request.url).pathname;
        if (path.startsWith("/admin/")) {
          if (!admin) throw new HttpError(404, "not_found");
          return decorate(await adminRequest(request, env, path));
        }
        await ensureTrial(env.DB, identity.uid, identity.email);
        if (path === "/me" && request.method === "GET") {
          const user = await account(env.DB, identity.uid);
          return decorate(Response.json({ points: Math.max(0, user?.points ?? 0), monthly: user?.monthly ?? 0, renews_at: user?.monthly ? user.renews_at : null, tiers: TIERS, admin }));
        }
        if (path !== "/generate" || request.method !== "POST") throw new HttpError(404, "not_found");
        const value: unknown = JSON.parse(await readBody(request, 100_000));
        const prepared = await prepareGeneration(value, identity.uid);
        const debt = Number(env.MAX_OVERDRAFT_POINTS);
        if (!Number.isSafeInteger(debt) || debt < 0) throw new HttpError(500, "server_configuration");
        const reservation = await reserve(env.DB, identity.uid, prepared.units.map((unit) => unit.id), prepared.halfRate, debt);
        const model = MODELS[prepared.request.tier].model;
        try {
          const cursor = prepared.request.cursor && await ownsCursor(env.DB, identity.uid, prepared.request.cursor) ? prepared.request.cursor : undefined;
          const response = await fetcher(`${env.OPENAI_BASE_URL}/responses`, {
            method: "POST", headers: { authorization: `Bearer ${env.OPENAI_API_KEY}`, "content-type": "application/json" },
            body: JSON.stringify(upstreamRequest(prepared, cursor)), signal: AbortSignal.any([request.signal, AbortSignal.timeout(110_000)]),
          });
          if (!response.ok || !response.body) {
            await response.body?.cancel();
            throw new HttpError(response.status === 429 ? 429 : response.status >= 500 ? 503 : 500, "upstream_unavailable");
          }
          const finished = Promise.withResolvers<void>();
          ctx.waitUntil(finished.promise);
          const body = sanitizeResponseStream(response.body, { onTerminal: async (terminal) => {
            try { await settleGeneration(env.DB, reservation, prepared, terminal, model); finished.resolve(); }
            catch (reason) { finished.reject(reason); throw reason; }
          } });
          return decorate(new Response(body, { headers: { "content-type": "text/event-stream", ...(prepared.request.cursor && !cursor ? { "x-context-rebuilt": "1" } : {}) } }));
        } catch (reason) {
          await settle(env.DB, reservation, reservation.charges, { model });
          throw reason;
        }
      } catch (reason) {
        const error = reason instanceof HttpError ? reason : reason instanceof AuthenticationError ? new HttpError(401, "unauthorized") : reason instanceof BillingError ? new HttpError(reason.status, reason.message) : reason instanceof SyntaxError ? new HttpError(400, "invalid_input") : new HttpError(500, "upstream_unavailable");
        return decorate(Response.json({ error: { code: error.code, ...(error.field ? { field: error.field } : {}) } }, { status: error.status }));
      }
    },
    async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) { ctx.waitUntil(scheduledMaintenance(env.DB)); },
  };
}

export default createWorker();

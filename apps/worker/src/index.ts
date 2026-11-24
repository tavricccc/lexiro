import { OAuthProvider } from "@cloudflare/workers-oauth-provider";
import type { ExecutionContext } from "@cloudflare/workers-types";
import { z } from "zod";
import { AuthenticationError, verifyFirebaseToken, type FirebaseIdentity } from "./auth";
import { checkAppCheck } from "./app-check";
import { HttpError, issueText, readBody } from "./http";
import { Library } from "./library/repository";
import { handleLibraryApi, handleSharedSet } from "./library/api";
import { connectRoom, handleRoomApi, isRoomSocketPath } from "./rooms/api";
import { AgentTools, handleAgentMcp, type AgentIdentity } from "./agent/mcp";
import { authorizationInfo, finishAuthorization, startAuthorization } from "./agent/oauth";
import { checkRateLimit, RATE_LIMIT_PURGE_SQL } from "./agent/rate-limit";
import { guardAccount, guarded } from "./agent/guard";
import { deleteAccount } from "./agent/account";
import { handleAdminApi } from "./agent/admin";
import { recordProfile } from "./agent/profile";
import { APP_AUTH_PURGE_SQL, issueAppAuthCode, redeemAppAuthCode } from "./agent/app-auth";
import { unlimitedAccounts, type AgentEnv } from "./agent/types";
import { isAppOrigin } from "./agent/origins";

interface Dependencies {
  verify?: typeof verifyFirebaseToken;
}

export function createWorker(dependencies: Dependencies = {}) {
  const verify = dependencies.verify ?? verifyFirebaseToken;
  const library = (env: AgentEnv, uid: string) => new Library(env.CLOUD_DB, { unlimited: unlimitedAccounts(env.UNLIMITED_UIDS).has(uid) });

  /** Everything except /mcp, which the OAuth provider authenticates. */
  const defaults = {
    async fetch(request: Request, env: AgentEnv): Promise<Response> {
      const path = new URL(request.url).pathname;
      if (path === "/health") return Response.json({ service: "lexiro", version: 3 });
      if (path === "/authorize" && request.method === "GET") {
        await checkRateLimit(env.AGENT_DB, "authorize", request, Date.now());
        return startAuthorization(request, env);
      }
      // The native app has no Firebase session yet when it redeems; the PKCE verifier is its credential.
      if (path === "/app-auth/token" && request.method === "POST") {
        await checkRateLimit(env.AGENT_DB, "app_auth_token", request, Date.now());
        return redeemAppAuthCode(request, env.AGENT_DB, Date.now());
      }
      if (path.startsWith("/shared/") && request.method === "GET") {
        await checkRateLimit(env.AGENT_DB, "shared", request, Date.now());
        const shared = await handleSharedSet(path, new Library(env.CLOUD_DB));
        if (shared) return shared;
      }
      // App Check guards only the Firebase ID token paths.
      await checkAppCheck(request, env);
      const identity = await verify(request, env.FIREBASE_PROJECT_ID);
      // Deleting is not metered: recording its reads would recreate a row.
      if (path === "/account" && request.method === "DELETE") {
        await guardAccount(env, identity.uid);
        await deleteAccount(env, identity.uid, identity.authTime);
        return Response.json({ deleted: true });
      }
      await recordProfile(env.AGENT_DB, identity);
      return guarded(env, identity.uid, {}, (env) => signedIn(request, env, identity));
    },
  };

  async function signedIn(request: Request, env: AgentEnv, identity: FirebaseIdentity): Promise<Response> {
    const path = new URL(request.url).pathname;
    const handled = await handleLibraryApi(request, identity.uid, library(env, identity.uid));
    if (handled) return handled;
    if (path.startsWith("/admin/")) return handleAdminApi(request, env, identity);
    if (path === "/app-auth/codes" && request.method === "POST") return issueAppAuthCode(request, env.AGENT_DB, identity.uid, Date.now());
    if (path === "/rooms" || path.startsWith("/rooms/")) return handleRoomApi(request, identity.uid, env.ROOMS, env.AGENT_DB, Date.now());
    const oauth = /^\/oauth\/(request|approve)\/([0-9a-f-]{36})$/.exec(path);
    if (oauth?.[1] === "request" && request.method === "GET") return Response.json(await authorizationInfo(env, oauth[2]));
    if (oauth?.[1] === "approve" && request.method === "POST") {
      const { allow } = z.strictObject({ allow: z.boolean() }).parse(JSON.parse(await readBody(request, 2000)));
      return Response.json(await finishAuthorization(env, oauth[2], identity, allow));
    }
    if (path === "/connections" && request.method === "GET") {
      const grants = await env.OAUTH_PROVIDER.listUserGrants(encodeURIComponent(identity.uid), { limit: 100, cursor: new URL(request.url).searchParams.get("cursor") ?? undefined });
      const connections = await Promise.all(grants.items.map(async (grant) => ({
        id: grant.id, clientId: grant.clientId, createdAt: grant.createdAt,
        clientName: (await env.OAUTH_PROVIDER.lookupClient(grant.clientId))?.clientName ?? grant.clientId,
      })));
      return Response.json({ connections, cursor: grants.cursor });
    }
    const connection = /^\/connections\/([^/]+)$/.exec(path);
    if (connection && request.method === "DELETE") {
      await env.OAUTH_PROVIDER.revokeGrant(decodeURIComponent(connection[1]), encodeURIComponent(identity.uid));
      return Response.json({ revoked: true });
    }
    throw new HttpError(404, "not_found");
  }

  const provider = (settings: AgentEnv) =>
    new OAuthProvider<AgentEnv>({
      apiRoute: "/mcp",
      apiHandler: {
        fetch: (request: Request, env: AgentEnv, context: { props: unknown; auth: { scope: string[] } }) => {
          const identity = z.object({ uid: z.string(), email: z.string(), setId: z.string().optional() }).parse(context.props) as AgentIdentity;
          if (!context.auth.scope.includes("sets:read") || !context.auth.scope.includes("sets:write")) throw new HttpError(403, "insufficient_scope");
          return guarded(env, identity.uid, { agent: true }, (env) => handleAgentMcp(request, new AgentTools(library(env, identity.uid), identity)));
        },
      },
      defaultHandler: defaults,
      authorizeEndpoint: "/authorize",
      tokenEndpoint: "/oauth/token",
      clientRegistrationEndpoint: "/oauth/register",
      scopesSupported: ["sets:read", "sets:write", "offline_access"],
      resourceMetadata: { resource: `${settings.AGENT_PUBLIC_URL}/mcp`, authorization_servers: [settings.AGENT_PUBLIC_URL] },
      clientIdMetadataDocumentEnabled: true,
      accessTokenTTL: 3600,
      refreshTokenTTL: 2_592_000,
    });

  return {
    async scheduled(_event: unknown, env: AgentEnv) {
      const now = Date.now(), cutoff = now - 7 * 86_400_000;
      await env.AGENT_DB.batch([
        env.AGENT_DB.prepare("DELETE FROM agent_authorizations WHERE expires_at<?").bind(now),
        env.AGENT_DB.prepare(RATE_LIMIT_PURGE_SQL).bind(cutoff),
        env.AGENT_DB.prepare(APP_AUTH_PURGE_SQL).bind(now),
      ]);
      await new Library(env.CLOUD_DB).purgeReceipts(now);
      const cursor = await env.OAUTH_KV.get("agent:purge-cursor");
      const result = await provider(env).purgeExpiredData(env, { batchSize: 50, cursor: cursor ?? undefined });
      if (result.cursor) await env.OAUTH_KV.put("agent:purge-cursor", result.cursor);
      else await env.OAUTH_KV.delete("agent:purge-cursor");
    },

    async fetch(request: Request, env: AgentEnv, ctx: ExecutionContext): Promise<Response> {
      const origin = request.headers.get("origin");
      const allowed = isAppOrigin(env, origin);
      const headers: Record<string, string> = {
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
        ...(allowed && origin ? { "Access-Control-Allow-Origin": origin } : {}),
        "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, MCP-Protocol-Version, X-Firebase-AppCheck",
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        "Access-Control-Max-Age": "86400",
        "Access-Control-Expose-Headers": "Lexiro-Revision, Lexiro-Revision-Before",
        Vary: "Origin",
      };
      const decorate = (response: Response) => {
        const next = new Headers(response.headers);
        for (const [key, value] of Object.entries(headers)) next.set(key, value);
        return new Response(response.body, { status: response.status, headers: next });
      };
      try {
        if (origin && !allowed) throw new HttpError(403, "forbidden_origin");
        if (request.method === "OPTIONS") return decorate(new Response(null, { status: 204 }));
        const path = new URL(request.url).pathname;
        // A socket upgrade must reach the client untouched; rebuilding the response would drop it.
        if (isRoomSocketPath(path)) {
          if (!allowed) throw new HttpError(403, "forbidden_origin");
          return await connectRoom(request, env.ROOMS);
        }
        // Client registration happens inside the provider, so throttle it before delegating.
        if (path === "/oauth/register" && request.method === "POST") await checkRateLimit(env.AGENT_DB, "oauth_register", request, Date.now());
        return decorate(await provider(env).fetch(request, env, ctx));
      } catch (reason) {
        return decorate(errorResponse(reason));
      }
    },
  };
}

export function errorResponse(reason: unknown): Response {
  const status = reason instanceof HttpError ? reason.status
    : reason instanceof AuthenticationError ? 401
    : reason instanceof z.ZodError || reason instanceof SyntaxError ? 400
    : 500;
  const code = reason instanceof HttpError ? reason.code : status === 401 ? "unauthorized" : status === 400 ? "invalid_input" : "unavailable";
  const explain = status === 400 || (reason instanceof HttpError && status < 500 && reason.message !== reason.code);
  if (status === 500) console.error(reason);
  return Response.json(
    { error: { code, ...(explain ? { message: issueText(reason) } : {}) } },
    { status, headers: reason instanceof HttpError && reason.retryAfter ? { "retry-after": reason.retryAfter } : {} },
  );
}

export default createWorker();
export { GameRoom } from "./rooms/game-room";

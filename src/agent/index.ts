import { OAuthProvider } from "@cloudflare/workers-oauth-provider";
import type { ExecutionContext } from "@cloudflare/workers-types";
import { z } from "zod";
import { verifyFirebaseToken, AuthenticationError } from "../auth";
import { checkAppCheck } from "../app-check";
import { readBody, HttpError, issueText } from "../http";
import { D1AgentLibrary } from "./library-repository";
import { handleCloudApi } from "../cloud/api";
import { purgeCloudOperations } from "../cloud/repository";
import { handleShareApi } from "../cloud/shares";
import { connectRoom, handleRoomApi, isRoomSocketPath } from "../rooms/api";
import type { AgentEnv, AgentIdentity, AgentLibraryRepository } from "./types";
import { createAgentLink, linkIdentity, linkOptions } from "./access";
import { readAgentSet } from "./operations";
import { AGENT_INSTRUCTIONS } from "./instructions";
import { handleAgentAccess } from "./resource-api";
import { handleAgentMcp } from "./mcp";
import {
  startAuthorization,
  authorizationInfo,
  finishAuthorization,
} from "./oauth";
import { checkRateLimit, RATE_LIMIT_PURGE_SQL } from "./rate-limit";
import { guardAccount, guarded } from "./guard";
import { deleteAccount } from "./account";
import { handleAdminApi } from "./admin";
import { recordProfile } from "./profile";
import { unlimitedAccounts } from "../cloud/repository";
import {
  APP_AUTH_PURGE_SQL,
  issueAppAuthCode,
  redeemAppAuthCode,
} from "./app-auth";

interface Dependencies {
  verify?: typeof verifyFirebaseToken;
  repository?: (env: AgentEnv) => AgentLibraryRepository;
}
export function createAgentWorker(dependencies: Dependencies = {}) {
  const repositories = new WeakMap<object, AgentLibraryRepository>();
  const repository = (env: AgentEnv) => {
    let repo = repositories.get(env);
    if (!repo) {
      repo = dependencies.repository?.(env) ?? new D1AgentLibrary(env);
      repositories.set(env, repo);
    }
    return repo;
  };
  const verify = dependencies.verify ?? verifyFirebaseToken;
  const defaults = {
    async fetch(request: Request, env: AgentEnv): Promise<Response> {
      const path = new URL(request.url).pathname;
      if (path === "/authorize" && request.method === "GET") {
        await checkRateLimit(env.AGENT_DB, "authorize", request, Date.now());
        return startAuthorization(request, env);
      }
      if (path === "/health")
        return Response.json({ service: "lexiro-agent", version: 1 });
      // The native app has no Firebase session yet when it redeems, so this
      // sits before the token check; the PKCE verifier is its credential.
      if (path === "/app-auth/token" && request.method === "POST") {
        await checkRateLimit(
          env.AGENT_DB,
          "app_auth_token",
          request,
          Date.now(),
        );
        return redeemAppAuthCode(request, env.AGENT_DB, Date.now());
      }
      const access = /^\/access\/([0-9a-f-]{36})(\/.*)?$/.exec(path);
      if (access) {
        const identity = await linkIdentity(request, env, access[1]);
        return guarded(env, identity.uid, { agent: true }, (env) =>
          handleAgentAccess(
            request,
            env,
            repository(env),
            identity,
            access[1],
            access[2] ?? "",
          ),
        );
      }
      // App Check only guards the browser Firebase ID token paths. MCP bearer,
      // link tokens and OAuth provider endpoints never reach this call.
      await checkAppCheck(request, env);
      const identity = await verify(request, env.FIREBASE_PROJECT_ID);
      // Deleting is not metered: recording its reads would recreate a row.
      if (path === "/account" && request.method === "DELETE") {
        await guardAccount(env, identity.uid);
        await deleteAccount(env, identity.uid, identity.authTime);
        return Response.json({ deleted: true });
      }
      await recordProfile(env.AGENT_DB, identity);
      return guarded(env, identity.uid, {}, (env) =>
        signedIn(request, env, identity),
      );
    },
  };
  /** Routes for a request that carried a verified Firebase ID token. */
  async function signedIn(
    request: Request,
    env: AgentEnv,
    identity: Awaited<ReturnType<typeof verify>>,
  ): Promise<Response> {
    const path = new URL(request.url).pathname,
      repo = repository(env);
    if (path.startsWith("/admin/"))
      return handleAdminApi(request, env, identity);
    if (path === "/app-auth/codes" && request.method === "POST")
      return issueAppAuthCode(request, env.AGENT_DB, identity.uid, Date.now());
    if (path.startsWith("/sync/"))
      return handleCloudApi(request, identity.uid, env.CLOUD_DB, {
        unlimited: unlimitedAccounts(env.UNLIMITED_UIDS),
      });
    if (path === "/shares" || path.startsWith("/shares/"))
      return handleShareApi(request, identity.uid, env.CLOUD_DB, repo);
    if (path === "/rooms" || path.startsWith("/rooms/"))
      return handleRoomApi(
        request,
        identity.uid,
        env.ROOMS,
        env.AGENT_DB,
        Date.now(),
      );
    if (path === "/links" && request.method === "POST") {
      const input = linkOptions.parse(
        JSON.parse(await readBody(request, 2000)),
      );
      await readAgentSet(repo, identity, input.setId);
      return Response.json(await createAgentLink(env, identity.uid, input), {
        status: 201,
      });
    }
    if (path === "/links" && request.method === "GET") {
      const links = await env.AGENT_DB.prepare(
        "SELECT id,set_id AS setId,expires_at AS expiresAt,revoked_at AS revokedAt FROM agent_links WHERE uid=? ORDER BY created_at DESC LIMIT 100",
      )
        .bind(identity.uid)
        .all();
      return Response.json({ links: links.results });
    }
    const revoke = /^\/links\/([0-9a-f-]{36})$/.exec(path);
    if (revoke && request.method === "DELETE") {
      const updated = await env.AGENT_DB.prepare(
        "UPDATE agent_links SET revoked_at=? WHERE id=? AND uid=? RETURNING id",
      )
        .bind(Date.now(), revoke[1], identity.uid)
        .first();
      if (!updated) throw new HttpError(404, "link_not_found");
      return Response.json({ revoked: true });
    }
    const oauth = /^\/oauth\/(request|approve)\/([0-9a-f-]{36})$/.exec(path);
    if (oauth?.[1] === "request" && request.method === "GET")
      return Response.json(await authorizationInfo(env, oauth[2]));
    if (oauth?.[1] === "approve" && request.method === "POST") {
      const { allow } = z
        .strictObject({ allow: z.boolean() })
        .parse(JSON.parse(await readBody(request, 2000)));
      return Response.json(
        await finishAuthorization(env, oauth[2], identity, allow),
      );
    }
    if (path === "/connections" && request.method === "GET") {
      const url = new URL(request.url);
      const grants = await env.OAUTH_PROVIDER.listUserGrants(
        encodeURIComponent(identity.uid),
        { limit: 100, cursor: url.searchParams.get("cursor") ?? undefined },
      );
      const connections = await Promise.all(
        grants.items.map(async (grant) => ({
          id: grant.id,
          clientId: grant.clientId,
          clientName:
            (await env.OAUTH_PROVIDER.lookupClient(grant.clientId))
              ?.clientName ?? grant.clientId,
          createdAt: grant.createdAt,
        })),
      );
      return Response.json({ connections, cursor: grants.cursor });
    }
    const connection = /^\/connections\/([^/]+)$/.exec(path);
    if (connection && request.method === "DELETE") {
      await env.OAUTH_PROVIDER.revokeGrant(
        decodeURIComponent(connection[1]),
        encodeURIComponent(identity.uid),
      );
      return Response.json({ revoked: true });
    }
    throw new HttpError(404, "not_found");
  }
  const provider = (settings: AgentEnv) =>
    new OAuthProvider<AgentEnv>({
      apiRoute: "/mcp",
      apiHandler: {
        fetch: (
          request: Request,
          env: AgentEnv,
          context: { props: unknown; auth: { scope: string[] } },
        ) => {
          const identity = z
            .object({
              uid: z.string(),
              email: z.string(),
              setId: z.string().optional(),
            })
            .parse(context.props as unknown) as AgentIdentity;
          if (
            !context.auth.scope.includes("sets:read") ||
            !context.auth.scope.includes("sets:write")
          )
            throw new HttpError(403, "insufficient_scope");
          return guarded(env, identity.uid, { agent: true }, (env) =>
            handleAgentMcp(request, identity, repository(env)),
          );
        },
      },
      defaultHandler: defaults,
      authorizeEndpoint: "/authorize",
      tokenEndpoint: "/oauth/token",
      clientRegistrationEndpoint: "/oauth/register",
      scopesSupported: ["sets:read", "sets:write", "offline_access"],
      resourceMetadata: {
        resource: `${settings.AGENT_PUBLIC_URL}/mcp`,
        authorization_servers: [settings.AGENT_PUBLIC_URL],
      },
      clientIdMetadataDocumentEnabled: true,
      accessTokenTTL: 3600,
      refreshTokenTTL: 2592000,
    });
  return {
    async scheduled(_event: unknown, env: AgentEnv) {
      const cutoff = Date.now() - 7 * 86400000;
      await env.AGENT_DB.batch([
        env.AGENT_DB.prepare(
          "DELETE FROM agent_authorizations WHERE expires_at<?",
        ).bind(Date.now()),
        env.AGENT_DB.prepare(
          "DELETE FROM agent_links WHERE expires_at<? OR revoked_at<?",
        ).bind(cutoff, cutoff),
        env.AGENT_DB.prepare(RATE_LIMIT_PURGE_SQL).bind(cutoff),
        env.AGENT_DB.prepare(APP_AUTH_PURGE_SQL).bind(Date.now()),
      ]);
      await purgeCloudOperations(env.CLOUD_DB, Date.now());
      const cursor = await env.OAUTH_KV.get("agent:purge-cursor");
      const result = await provider(env).purgeExpiredData(env, {
        batchSize: 50,
        cursor: cursor ?? undefined,
      });
      if (result.cursor)
        await env.OAUTH_KV.put("agent:purge-cursor", result.cursor);
      else await env.OAUTH_KV.delete("agent:purge-cursor");
    },
    async fetch(
      request: Request,
      env: AgentEnv,
      ctx: ExecutionContext,
    ): Promise<Response> {
      const origin = request.headers.get("origin");
      const headers = {
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
        ...(origin === env.APP_ORIGIN
          ? { "Access-Control-Allow-Origin": origin }
          : {}),
        "Access-Control-Allow-Headers":
          "Authorization, Content-Type, Accept, MCP-Protocol-Version, X-Firebase-AppCheck",
        "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
        "Access-Control-Max-Age": "86400",
        Vary: "Origin",
      };
      const decorate = (response: Response) => {
        const next = new Headers(response.headers);
        for (const [key, value] of Object.entries(headers))
          next.set(key, value);
        return new Response(response.body, {
          status: response.status,
          headers: next,
        });
      };
      try {
        if (origin && origin !== env.APP_ORIGIN)
          throw new HttpError(403, "forbidden_origin");
        if (request.method === "OPTIONS")
          return decorate(new Response(null, { status: 204 }));
        // A socket upgrade must reach the client untouched: rebuilding the
        // response to add headers would drop the socket. Browsers always send
        // Origin on a WebSocket, so the app origin is required here.
        const path = new URL(request.url).pathname;
        if (isRoomSocketPath(path)) {
          if (origin !== env.APP_ORIGIN)
            throw new HttpError(403, "forbidden_origin");
          return await connectRoom(request, env.ROOMS);
        }
        // Dynamic client registration is handled inside the OAuth provider,
        // so the unauthenticated throttle must run before it is delegated.
        if (path === "/oauth/register" && request.method === "POST")
          await checkRateLimit(
            env.AGENT_DB,
            "oauth_register",
            request,
            Date.now(),
          );
        return decorate(await provider(env).fetch(request, env, ctx));
      } catch (reason) {
        const status =
          reason instanceof HttpError
            ? reason.status
            : reason instanceof AuthenticationError
              ? 401
              : reason instanceof z.ZodError || reason instanceof SyntaxError
                ? 400
                : 500;
        return decorate(
          Response.json(
            {
              error: {
                code:
                  reason instanceof HttpError
                    ? reason.code
                    : status === 401
                      ? "unauthorized"
                      : status === 400
                        ? "invalid_input"
                        : "agent_unavailable",
                ...(status === 400 ||
                (reason instanceof HttpError &&
                  status < 500 &&
                  reason.message !== reason.code)
                  ? {
                      message: issueText(reason),
                    }
                  : {}),
              },
            },
            {
              status,
              headers:
                reason instanceof HttpError && reason.retryAfter
                  ? { "retry-after": reason.retryAfter }
                  : {},
            },
          ),
        );
      }
    },
  };
}
export default createAgentWorker();
export { GameRoom } from "../rooms/game-room";
export { AGENT_INSTRUCTIONS };

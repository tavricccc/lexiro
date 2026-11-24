import { z } from "zod";
import type { AuthRequest } from "@cloudflare/workers-oauth-provider";
import type { AgentEnv, AgentIdentity } from "./types";
import { HttpError } from "../http";
interface StoredAuthorization {
  request_json: string;
  client_name: string;
  expires_at: number;
}
export async function startAuthorization(request: Request, env: AgentEnv) {
  const parsed = await env.OAUTH_PROVIDER.parseAuthRequest(request);
  if (!parsed.codeChallenge || parsed.codeChallengeMethod !== "S256")
    throw new HttpError(400, "pkce_required");
  if (
    parsed.scope.some(
      (scope) => !["sets:read", "sets:write", "offline_access"].includes(scope),
    )
  )
    throw new HttpError(400, "invalid_scope");
  const client = await env.OAUTH_PROVIDER.lookupClient(parsed.clientId);
  if (!client) throw new HttpError(400, "unknown_client");
  const id = crypto.randomUUID();
  await env.AGENT_DB.prepare(
    "INSERT INTO agent_authorizations(id,request_json,client_name,expires_at) VALUES(?,?,?,?)",
  )
    .bind(
      id,
      JSON.stringify(parsed),
      client.clientName ?? parsed.clientId,
      Date.now() + 600000,
    )
    .run();
  return Response.redirect(
    `${env.APP_ORIGIN}/agent/authorize?request=${id}`,
    302,
  );
}
async function storedRequest(env: AgentEnv, id: string) {
  z.string().uuid().parse(id);
  const stored = await env.AGENT_DB.prepare(
    "SELECT request_json,client_name,expires_at FROM agent_authorizations WHERE id=?",
  )
    .bind(id)
    .first<StoredAuthorization>();
  if (!stored || stored.expires_at <= Date.now())
    throw new HttpError(410, "authorization_expired");
  return { stored, auth: JSON.parse(stored.request_json) as AuthRequest };
}
export async function authorizationInfo(env: AgentEnv, id: string) {
  const { stored, auth } = await storedRequest(env, id);
  return {
    clientName: stored.client_name,
    clientId: auth.clientId,
    redirectHost: new URL(auth.redirectUri).host,
    scopes: auth.scope,
  };
}
export async function finishAuthorization(
  env: AgentEnv,
  id: string,
  identity: AgentIdentity,
  allow: boolean,
) {
  const { auth } = await storedRequest(env, id);
  const taken = await env.AGENT_DB.prepare(
    "DELETE FROM agent_authorizations WHERE id=? AND expires_at>? RETURNING id",
  )
    .bind(id, Date.now())
    .first();
  if (!taken) throw new HttpError(410, "authorization_expired");
  if (!allow) {
    const url = new URL(auth.redirectUri);
    url.searchParams.set("error", "access_denied");
    url.searchParams.set("state", auth.state);
    url.searchParams.set("iss", env.AGENT_PUBLIC_URL);
    return { redirectTo: url.toString() };
  }
  return env.OAUTH_PROVIDER.completeAuthorization({
    request: auth,
    userId: encodeURIComponent(identity.uid),
    metadata: { email: identity.email },
    scope: auth.scope.length ? auth.scope : ["sets:read", "sets:write"],
    props: identity,
  });
}

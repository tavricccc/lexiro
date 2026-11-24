import { HttpError } from "../http";
import { Library } from "../library/repository";
import type { AgentEnv } from "./types";

/**
 * How recently the user must have signed in to delete their account, as
 * Firebase asks before it deletes the user: a token that has only been
 * refreshed, or taken from a device left signed in, cannot erase the data.
 */
export const ACCOUNT_DELETION_SIGN_IN_WINDOW_S = 10 * 60;

/**
 * Erases the account's library, learning and share links, its app sign-in
 * codes and every MCP grant. Running it again finds nothing and succeeds.
 * disabled_accounts is kept: it is the operator's record.
 */
export async function deleteAccount(env: AgentEnv, uid: string, authTime: number, now = Date.now()): Promise<void> {
  if (now / 1000 - authTime > ACCOUNT_DELETION_SIGN_IN_WINDOW_S) throw new HttpError(403, "recent_sign_in_required");
  await new Library(env.CLOUD_DB).deleteAccount(uid);
  await env.AGENT_DB.batch(["app_auth_codes", "account_reads", "account_profiles"].map((table) =>
    env.AGENT_DB.prepare(`DELETE FROM ${table} WHERE uid=?`).bind(uid)));
  // List every grant before revoking any, so a cursor never skips one.
  const user = encodeURIComponent(uid);
  const ids: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await env.OAUTH_PROVIDER.listUserGrants(user, { limit: 100, cursor });
    ids.push(...page.items.map((grant) => grant.id));
    cursor = page.cursor;
  } while (cursor);
  for (const id of ids) await env.OAUTH_PROVIDER.revokeGrant(id, user);
}

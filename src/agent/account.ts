import { HttpError } from "../http";
import type { AgentEnv } from "./types";

/**
 * How recently the user must have signed in to delete their account. Firebase
 * asks the same before it deletes the user, so a token that has only been
 * refreshed, or taken from a device left signed in, cannot erase the data.
 */
export const ACCOUNT_DELETION_SIGN_IN_WINDOW_S = 10 * 60;

/** Child tables first: cloud_records references cloud_accounts. */
const CLOUD_TABLES = [
  "cloud_records",
  "cloud_memberships",
  "cloud_question_sources",
  "cloud_blobs",
  "cloud_learning",
  "cloud_operations",
  "cloud_set_cache",
] as const;

/**
 * Erases everything the account stored: its library, documents, receipts and
 * share links, its access links and app sign-in codes, and every MCP grant.
 * Running it again finds nothing and succeeds, so a client can retry after a
 * failure part way. disabled_accounts is kept: it is the operator's record.
 */
export async function deleteAccount(
  env: AgentEnv,
  uid: string,
  authTime: number,
  now = Date.now(),
): Promise<void> {
  if (now / 1000 - authTime > ACCOUNT_DELETION_SIGN_IN_WINDOW_S)
    throw new HttpError(403, "recent_sign_in_required");
  await env.CLOUD_DB.batch([
    ...CLOUD_TABLES.map((table) =>
      env.CLOUD_DB.prepare(`DELETE FROM ${table} WHERE uid=?`).bind(uid),
    ),
    env.CLOUD_DB.prepare("DELETE FROM set_shares WHERE owner_uid=?").bind(uid),
    env.CLOUD_DB.prepare("DELETE FROM cloud_accounts WHERE uid=?").bind(uid),
  ]);
  await env.AGENT_DB.batch([
    env.AGENT_DB.prepare("DELETE FROM agent_links WHERE uid=?").bind(uid),
    env.AGENT_DB.prepare("DELETE FROM app_auth_codes WHERE uid=?").bind(uid),
    env.AGENT_DB.prepare("DELETE FROM account_reads WHERE uid=?").bind(uid),
    env.AGENT_DB.prepare("DELETE FROM account_profiles WHERE uid=?").bind(uid),
  ]);
  // List every grant before revoking any, so a cursor never skips a grant
  // that moved up when an earlier one was removed.
  const user = encodeURIComponent(uid);
  const ids: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await env.OAUTH_PROVIDER.listUserGrants(user, {
      limit: 100,
      cursor,
    });
    ids.push(...page.items.map((grant) => grant.id));
    cursor = page.cursor;
  } while (cursor);
  for (const id of ids) await env.OAUTH_PROVIDER.revokeGrant(id, user);
}

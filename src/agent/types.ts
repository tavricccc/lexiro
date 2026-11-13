import type { D1Database, KVNamespace } from "@cloudflare/workers-types";
import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import type { RoomNamespace } from "../rooms/api";
export type { AgentIdentity } from "./mcp";

export interface AgentEnv {
  AGENT_DB: D1Database;
  CLOUD_DB: D1Database;
  OAUTH_KV: KVNamespace;
  OAUTH_PROVIDER: OAuthHelpers;
  AGENT_PUBLIC_URL: string;
  APP_ORIGIN: string;
  FIREBASE_PROJECT_ID: string;
  /** Firebase project number for App Check; absent disables enforcement. */
  FIREBASE_PROJECT_NUMBER?: string;
  /** "off" | "monitor" | "enforce"; anything else (or absent) means off. */
  APP_CHECK_MODE?: string;
  ROOMS: RoomNamespace;
  /** Workers Rate Limiting binding keyed by uid; absent in local tests. */
  USER_LIMITER?: RateLimiter;
  /** Comma-separated uids exempt from the per-account limits. */
  UNLIMITED_UIDS?: string;
  /** Comma-separated emails of operators; a secret, never in the repo. */
  ADMIN_EMAILS?: string;
}
/** The Workers Rate Limiting binding's API. */
export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

/** Reads the comma- or newline-separated UNLIMITED_UIDS variable. */
export function unlimitedAccounts(value: string | undefined): Set<string> {
  return new Set((value ?? "").split(/[,\n]/).map((uid) => uid.trim()).filter(Boolean));
}
export function secondsToNextUtcDay(now: number): string {
  return String(Math.ceil((86_400_000 - (now % 86_400_000)) / 1000));
}

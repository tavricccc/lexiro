import type { D1Database, DurableObjectNamespace } from "@cloudflare/workers-types";
export interface Env {
  DB: D1Database;
  GENERATIONS?: DurableObjectNamespace;
  FIREBASE_PROJECT_ID: string;
  /** Firebase project number for App Check; absent disables enforcement. */
  FIREBASE_PROJECT_NUMBER?: string;
  /** "off" | "monitor" | "enforce"; anything else (or absent) means off. */
  APP_CHECK_MODE?: string;
  ADMIN_EMAILS: string;
  OPENAI_API_KEY: string;
  OPENAI_BASE_URL: string;
  /** Comma-separated list of origins allowed to call this Worker. */
  ALLOWED_ORIGIN: string;
}

import type { D1Database } from "@cloudflare/workers-types";
export interface Env {
  DB: D1Database;
  FIREBASE_PROJECT_ID: string;
  ADMIN_EMAILS: string;
  OPENAI_API_KEY: string;
  OPENAI_BASE_URL: string;
  ALLOWED_ORIGIN: string;
  MAX_OVERDRAFT_POINTS: string;
}

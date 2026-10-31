import type { RoomNamespace } from "../rooms/api";
import type {
  D1Database,
  KVNamespace,
  ExecutionContext,
} from "@cloudflare/workers-types";
import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import type {
  AgentSetSnapshot,
  AgentMutationResult,
  AgentFolderMutation,
  AgentFolderMutationResult,
  VocabFolder,
  AgentQuestionReport,
} from "@lexiro/agent-contract";
import type { AgentQuery } from "./query";
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
  /** Comma-separated uids exempt from the per-account write and storage limits. */
  UNLIMITED_UIDS?: string;
  /** Comma-separated emails of operators; a secret, never in the repo. */
  ADMIN_EMAILS?: string;
}
/** The Workers Rate Limiting binding's API. */
export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}
export interface AgentIdentity {
  uid: string;
  email: string;
  setId?: string;
}
export interface MutationReceipt extends Partial<AgentQuestionReport> {
  operationId: string;
  setId: string;
  revision: string;
  wordCount: number;
  questionCount: number;
  deleted: boolean;
  /** Questions removed as a side effect, e.g. their word or sense was deleted. */
  removedQuestionIds?: string[];
  removedQuestionCount?: number;
}
export interface AgentLibraryRepository {
  query(uid: string, query: AgentQuery): Promise<Record<string, unknown>>;
  list(
    uid: string,
  ): Promise<{ id: string; setName: string; folderId: string }[]>;
  folders(uid: string): Promise<{ folders: VocabFolder[]; revision: string }>;
  mutateFolders(
    uid: string,
    revision: string | undefined,
    operationId: string,
    action: AgentFolderMutation,
  ): Promise<AgentFolderMutationResult>;
  read(uid: string, setId: string): Promise<AgentSetSnapshot | null>;
  create(uid: string, snapshot: AgentSetSnapshot): Promise<void>;
  mutate(
    uid: string,
    setId: string,
    revision: string | undefined,
    operationId: string,
    action: unknown,
    apply: (
      snapshot: AgentSetSnapshot,
      blockedQuestionIds: string[],
    ) => AgentMutationResult,
  ): Promise<MutationReceipt>;
}
export type AgentContext = ExecutionContext & { props?: unknown };

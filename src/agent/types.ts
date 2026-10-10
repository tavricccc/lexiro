import type {
  D1Database,
  KVNamespace,
  ExecutionContext,
} from "@cloudflare/workers-types";
import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import type {
  AgentSetSnapshot,
  AgentMutationResult,
} from "@lexiro/agent-contract";
export interface AgentEnv {
  AGENT_DB: D1Database;
  OAUTH_KV: KVNamespace;
  OAUTH_PROVIDER: OAuthHelpers;
  AGENT_PUBLIC_URL: string;
  APP_ORIGIN: string;
  FIREBASE_PROJECT_ID: string;
  FIREBASE_SERVICE_ACCOUNT: string;
}
export interface AgentIdentity {
  uid: string;
  email: string;
  setId?: string;
}
export interface MutationReceipt {
  operationId: string;
  setId: string;
  revision: string;
  wordCount: number;
  questionCount: number;
  deleted: boolean;
}
export interface AgentLibraryRepository {
  list(uid: string): Promise<{ id: string; setName: string }[]>;
  read(uid: string, setId: string): Promise<AgentSetSnapshot | null>;
  create(uid: string, snapshot: AgentSetSnapshot): Promise<void>;
  mutate(
    uid: string,
    setId: string,
    revision: string,
    operationId: string,
    action: unknown,
    apply: (snapshot: AgentSetSnapshot) => AgentMutationResult,
  ): Promise<MutationReceipt>;
}
export type AgentContext = ExecutionContext & { props?: unknown };

export type AiProvider = "openai" | "anthropic" | "google" | "custom";
export type AiProtocol =
  "responses" | "chat" | "messages" | "interactions" | "generateContent";
export interface AiSettings {
  version: 3;
  enabled: boolean;
  provider: AiProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
  protocol: AiProtocol;
  batchSize: number;
  structuredOutput: boolean;
  contextTokens: number;
  maxOutputTokens: number;
  reasoningEffort: string;
}
export interface AiProviderCapabilities {
  contextTokens: number;
  maxOutputTokens: number;
  structuredOutput: boolean;
  cache: "openai" | "anthropic" | "implicit" | "unknown";
}
export interface AiModelPreset extends AiProviderCapabilities {
  reasoningEffort: string;
  reasoningOptions?: readonly string[];
  id: string;
  label: string;
  provider: AiProvider;
  protocol: AiProtocol;
}
export interface AiUsage {
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}
export type AiPhase =
  | "connecting"
  | "thinking"
  | "generating"
  | "validating"
  | "retrying"
  | "rebuilding";
export interface AiMessage {
  role: "user" | "assistant";
  content: string;
}
export interface AiSession {
  settings: AiSettings;
  context: string;
  history: AiMessage[];
  cursor?: string;
  usage: AiUsage;
  notices: string[];
  stream: boolean;
  structuredOutput: boolean;
  cache: boolean;
}
export interface AiTurnResult {
  text: string;
  id?: string;
  requestId?: string;
  usage: AiUsage;
  stopReason: "complete" | "truncated" | "blocked" | "unknown";
  complete: boolean;
}
export interface AiTurnOptions {
  signal?: AbortSignal;
  schema?: Record<string, unknown>;
  responseFormat?: "json" | "text";
  maxOutputTokens?: number;
  onCharacters?: (count: number) => void;
  onPhase?: (phase: AiPhase) => void;
  onUsage?: (usage: AiUsage) => void;
}
export interface AiTask<TItem> {
  id: string;
  context: string;
  steps: AiTaskStep<TItem>[];
  schema: Record<string, unknown>;
  key?: (item: TItem) => string;
}
export interface AiTaskStep<TItem> {
  id: string;
  context: string;
  prompt: string;
  count: number;
  parse: (text: string) => TItem[];
  recover?: (text: string) => {
    items: TItem[];
    completed: number;
    remaining: AiTaskStep<TItem>;
  } | null;
  /** Independent units, used to reduce a truncated turn without splitting a passage. */
  split?: () => AiTaskStep<TItem>[];
}

import type { JobKind, Tier } from "@lexiro/ai-contract";
export type AiPhase = "connecting" | "thinking" | "generating" | "validating" | "retrying" | "rebuilding";
export interface AiSession {
  tier: Tier;
  sessionId: string;
  context: string;
  cursor?: string;
  append?: boolean;
  notices: string[];
}
export interface AiTurnResult { text: string; id?: string; stopReason: "complete" | "truncated" | "blocked" | "unknown"; complete: boolean }
export interface AiTurnOptions { signal?: AbortSignal; repair?: string; onCharacters?: (count: number) => void; onPhase?: (phase: AiPhase) => void }
export interface AiTask<T> { id: string; kind: JobKind; billableCount: number; context: string; steps: AiTaskStep<T>[]; key?: (item: T) => string }
export interface AiTaskStep<T> {
  id: string;
  context: string;
  /** Serialized generation data, never a system prompt. */
  prompt: string;
  count: number;
  parse: (text: string) => T[];
  recover?: (text: string) => { items: T[]; completed: number; remaining: AiTaskStep<T> } | null;
  split?: () => AiTaskStep<T>[];
}

import type { AiSession, AiTurnOptions, AiTurnResult } from "@/src/types/ai";
import type { GenerationInput, Tier } from "@lexiro/ai-contract";
import { managedTurn } from "@/lib/managed-client";

export function createAiSession(tier: Tier, context: string): AiSession {
  return { tier, context, sessionId: crypto.randomUUID(), notices: [], usage: {} };
}
export function resetConversation(session: AiSession) { session.cursor = undefined; }
export function commitTurn(session: AiSession, _input: string, reply: AiTurnResult) { session.cursor = reply.id; }
export function generateTurn(session: AiSession, input: string, options: AiTurnOptions = {}) {
  return managedTurn(session, JSON.parse(input) as GenerationInput, options);
}

import type { AiSession, AiTurnOptions, AiTurnResult } from "@/src/types/ai";
import type { AiModel, GenerationInput, Tier } from "@lexiro/ai-contract";
import { managedTurn } from "@/lib/managed-client";
import { useAiPreferencesStore } from "@/stores/ai-preferences-store";

export function createAiSession(tier: Tier, context: string, model: AiModel = useAiPreferencesStore.getState().preferences.model): AiSession {
  return {
    tier,
    model,
    context,
    sessionId: crypto.randomUUID(),
    notices: [],
    usage: {},
  };
}
export function resetConversation(session: AiSession) {
  session.cursor = undefined;
}
export function commitTurn(
  session: AiSession,
  _input: string,
  reply: AiTurnResult,
) {
  session.cursor = reply.id;
}
export function generateTurn(
  session: AiSession,
  input: string,
  options: AiTurnOptions = {},
) {
  return managedTurn(session, JSON.parse(input) as GenerationInput, options);
}

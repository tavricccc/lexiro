import type {
  AiSession,
  AiSettings,
  AiTurnOptions,
  AiTurnResult,
} from "@/src/types/ai";
import { t } from "@/lib/i18n";
import { contextLimit, outputLimit } from "./catalog";
import { AiNotConfiguredError, AiRequestError } from "./errors";
import { buildRequest } from "./request";
import { addUsage } from "./reply";
import { sendRequest } from "./transport";

/** Conservative planning estimate, not a provider token count. */
export const estimateTokens = (text: string) =>
  Math.ceil(new TextEncoder().encode(text).length / 2);
export function createAiSession(
  settings: AiSettings,
  context: string,
  cache = true,
): AiSession {
  return {
    settings: { ...settings },
    context,
    history: [],
    usage: {},
    notices: [],
    stream: true,
    structuredOutput: settings.structuredOutput,
    cache,
  };
}
export function resetConversation(session: AiSession) {
  session.cursor = undefined;
  session.history = [];
}
export function commitTurn(
  session: AiSession,
  prompt: string,
  reply: AiTurnResult,
) {
  session.history.push(
    { role: "user", content: prompt },
    { role: "assistant", content: reply.text },
  );
  session.cursor = reply.id;
}
export async function generateTurn(
  session: AiSession,
  prompt: string,
  options: AiTurnOptions = {},
): Promise<AiTurnResult> {
  const settings = session.settings;
  if (!settings.enabled || !settings.apiKey.trim() || !settings.model.trim())
    throw new AiNotConfiguredError(t("ai.notConfigured"));
  if (settings.provider === "custom" && !settings.baseUrl.trim())
    throw new AiNotConfiguredError(t("ai.endpointRequired"));
  options.signal?.throwIfAborted();
  const limit = contextLimit(settings) * 0.8;
  const baseTokens =
    estimateTokens(
      session.context + prompt + JSON.stringify(options.schema ?? {}),
    ) + outputLimit(settings);
  if (baseTokens > limit)
    throw new AiRequestError(t("ai.contextTooLarge"), {
      retryable: false,
      code: "context_limit",
    });
  if (baseTokens + estimateTokens(JSON.stringify(session.history)) > limit) {
    resetConversation(session);
    options.onPhase?.("rebuilding");
    if (!session.notices.includes(t("ai.contextRebuilt")))
      session.notices.push(t("ai.contextRebuilt"));
  }
  let rebuilt = false;
  for (;;) {
    try {
      return await sendRequest(
        buildRequest(session, prompt, options),
        settings.protocol,
        {
          ...options,
          onUsage: (usage) => {
            session.usage = addUsage(session.usage, usage);
            options.onUsage?.(session.usage);
          },
        },
      );
    } catch (reason) {
      if (!(reason instanceof AiRequestError) || options.signal?.aborted)
        throw reason;
      if (
        session.cursor &&
        !rebuilt &&
        [400, 404, 410].includes(reason.status ?? 0) &&
        /previous_response|previous_interaction|not found|expired/iu.test(
          reason.message,
        )
      ) {
        resetConversation(session);
        rebuilt = true;
        options.onPhase?.("rebuilding");
        session.notices.push(t("ai.contextRebuilt"));
        continue;
      }
      // Only an explicit gateway capability rejection allows a fallback.
      if (
        (settings.provider === "custom" || settings.baseUrl) &&
        reason.status === 400
      ) {
        if (
          session.structuredOutput &&
          /response_format|json_schema|output_config|responseJsonSchema/iu.test(
            reason.message,
          )
        ) {
          session.structuredOutput = false;
          session.notices.push(t("ai.schemaFallback"));
          continue;
        }
        if (session.stream && /stream/iu.test(reason.message)) {
          session.stream = false;
          session.notices.push(t("ai.streamFallback"));
          continue;
        }
      }
      throw reason;
    }
  }
}

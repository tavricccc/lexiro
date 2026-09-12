// Public entry point shared by settings, import/export and one-shot callers.
export * from "./ai/settings";
export { AiNotConfiguredError, AiRequestError } from "./ai/errors";
export { extractJsonText } from "./ai/json";
import type { AiSettings } from "@/types";
import type { AiTurnOptions } from "@/src/types/ai";
import { createAiSession, generateTurn } from "./ai/session";
import { whenAiSettingsReady } from "./ai/settings";

export interface AiGenerationOptions extends AiTurnOptions {
  stream?: boolean;
}
export async function generateWithAi(
  settings: AiSettings,
  prompt: string,
  options: AiGenerationOptions = {},
): Promise<string> {
  const session = createAiSession(settings, "", false);
  session.stream = options.stream ?? true;
  return (await generateTurn(session, prompt, options)).text;
}
export async function generateWithSavedAi(
  prompt: string,
  options: AiGenerationOptions = {},
) {
  return generateWithAi(await whenAiSettingsReady(), prompt, options);
}

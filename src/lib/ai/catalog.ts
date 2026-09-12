import type {
  AiModelPreset,
  AiProtocol,
  AiProvider,
  AiSettings,
} from "@/src/types/ai";

// Official model catalogs checked 2026-09-12. IDs are explicit, never inferred.
export const AI_MODELS: AiModelPreset[] = [
  ...[
    ["gpt-5.6-luna", "GPT-5.6 Luna"],
    ["gpt-5.6-terra", "GPT-5.6 Terra"],
    ["gpt-5.6-sol", "GPT-5.6 Sol"],
    ["gpt-6-astra", "GPT-6 Astra"],
  ].map(([id, label]): AiModelPreset => ({
    id,
    label,
    provider: "openai",
    protocol: "responses",
    contextTokens: 1_050_000,
    maxOutputTokens: 128_000,
    structuredOutput: true,
    cache: "openai",
    reasoningEffort: "low",
    reasoningOptions: id.startsWith("gpt-5.6")
      ? ["none", "low", "medium", "high", "xhigh", "max"]
      : ["low", "medium", "high", "xhigh", "max", "ultra"],
  })),
  ...[
    ["claude-sonnet-5", "Claude Sonnet 5"],
    ["claude-opus-5", "Claude Opus 5"],
    ["claude-fable-5-1", "Claude Fable 5.1"],
    ["claude-haiku-4-5-20251001", "Claude Haiku 4.5"],
  ].map(([id, label]): AiModelPreset => ({
    id,
    label,
    provider: "anthropic",
    protocol: "messages",
    contextTokens: id.includes("haiku") ? 200_000 : 1_000_000,
    maxOutputTokens: id.includes("haiku") ? 64_000 : 128_000,
    structuredOutput: true,
    cache: "anthropic",
    reasoningEffort: id.includes("haiku") ? "" : "low",
    ...(id.includes("haiku")
      ? {}
      : { reasoningOptions: ["low", "medium", "high", "xhigh", "max"] }),
  })),
  ...[
    ["gemini-3.5-flash-lite", "Gemini 3.5 Flash-Lite"],
    ["gemini-3.8-flash", "Gemini 3.8 Flash"],
    ["gemini-3.1-flash-lite", "Gemini 3.1 Flash-Lite"],
    ["gemini-3.1-pro-preview", "Gemini 3.1 Pro Preview"],
  ].map(([id, label]): AiModelPreset => ({
    id,
    label,
    provider: "google",
    protocol: "interactions",
    contextTokens: 1_048_576,
    maxOutputTokens: 65_536,
    structuredOutput: true,
    cache: "implicit",
    reasoningEffort:
      id === "gemini-3.5-flash-lite"
        ? "medium"
        : id === "gemini-3.1-flash-lite"
          ? "minimal"
          : "low",
    reasoningOptions:
      id === "gemini-3.8-flash"
        ? ["low", "medium", "high"]
        : id === "gemini-3.1-pro-preview"
          ? ["low", "medium", "high"]
          : ["minimal", "low", "medium", "high"],
  })),
];
/**
 * How many words one segment covers.
 *
 * Every segment replays the conversation before it, so halving the segment
 * size does not halve the cost of a run — it roughly doubles the input it
 * sends. Twenty is where a run stops paying for its own history without
 * making any single reply long enough to be truncated often; the runner still
 * splits a segment in half on its own when one is.
 */
export const SEGMENT_SIZE = { min: 15, max: 30, default: 20 } as const;

export const AI_PROTOCOLS: AiProtocol[] = [
  "responses",
  "chat",
  "messages",
  "interactions",
  "generateContent",
];
export const PROTOCOL_LABELS: Record<AiProtocol, string> = {
  responses: "OpenAI Responses",
  chat: "OpenAI Chat Completions",
  messages: "Anthropic Messages",
  interactions: "Gemini Interactions",
  generateContent: "Gemini generateContent",
};
export const defaultProtocol = (provider: AiProvider): AiProtocol =>
  ({
    openai: "responses",
    anthropic: "messages",
    google: "interactions",
    custom: "chat",
  })[provider] as AiProtocol;
export const defaultModel = (provider: AiProvider) =>
  AI_MODELS.find((m) => m.provider === provider)?.id ?? "";
export const modelPreset = (settings: Pick<AiSettings, "provider" | "model">) =>
  AI_MODELS.find(
    (m) => m.provider === settings.provider && m.id === settings.model,
  );
export const defaultAiSettings: AiSettings = {
  version: 3,
  enabled: false,
  provider: "openai",
  apiKey: "",
  baseUrl: "",
  model: "gpt-5.6-luna",
  protocol: "responses",
  batchSize: SEGMENT_SIZE.default,
  structuredOutput: true,
  contextTokens: 0,
  maxOutputTokens: 8192,
  reasoningEffort: "low",
};
export function contextLimit(settings: AiSettings) {
  return (
    settings.contextTokens || modelPreset(settings)?.contextTokens || 32_768
  );
}
export function outputLimit(settings: AiSettings) {
  return Math.min(
    settings.maxOutputTokens,
    modelPreset(settings)?.maxOutputTokens ?? settings.maxOutputTokens,
  );
}
export function endpoint(settings: AiSettings): string {
  const base = settings.baseUrl.trim().replace(/\/+$/u, "");
  if (
    base &&
    /\/(?:responses|chat\/completions|messages|interactions)(?:\?.*)?$|:streamGenerateContent|:generateContent/u.test(
      base,
    )
  )
    return base;
  const roots: Record<AiProtocol, string> = {
    responses: "https://api.openai.com/v1",
    chat: "https://api.openai.com/v1",
    messages: "https://api.anthropic.com/v1",
    interactions: "https://generativelanguage.googleapis.com/v1beta",
    generateContent: "https://generativelanguage.googleapis.com/v1beta",
  };
  const paths: Record<AiProtocol, string> = {
    responses: "responses",
    chat: "chat/completions",
    messages: "messages",
    interactions: "interactions",
    generateContent: `models/${encodeURIComponent(settings.model)}:streamGenerateContent?alt=sse`,
  };
  return `${base || roots[settings.protocol]}/${paths[settings.protocol]}`;
}

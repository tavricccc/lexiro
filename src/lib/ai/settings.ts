import type { AiProvider, AiSettings } from "@/types";
import { AI_API_KEY_STORAGE_KEY, AI_SETTINGS_KEY } from "@/constants";
import { loadFromStorage, saveToStorage } from "@/lib/persist";
import { isRecord } from "../schema";
import {
  AI_MODELS,
  AI_PROTOCOLS,
  defaultAiSettings,
  defaultProtocol,
} from "./catalog";
import { t } from "@/lib/i18n";

export { defaultAiSettings } from "./catalog";
const providers: AiProvider[] = ["openai", "anthropic", "google", "custom"];
let storedSettings = { ...defaultAiSettings };
const listeners = new Set<(settings: AiSettings) => void>();
let persistence: Promise<void> = Promise.resolve();
let hydration: Promise<AiSettings> | null = null;
const oldKeys = ["enabled", "provider", "baseUrl", "model", "batchSize"];
const v2Keys = [
  ...oldKeys,
  "version",
  "protocol",
  "structuredOutput",
  "contextTokens",
  "maxOutputTokens",
];
const v3Keys = [...v2Keys, "reasoningEffort"];

/** Explicit one-way migration for the previous, unversioned persisted settings. */
export function migrateAiSettingsV1(
  value: Record<string, unknown>,
): Record<string, unknown> {
  if (Object.keys(value).some((key) => !oldKeys.includes(key)))
    throw new Error(t("ai.invalidSettings"));
  const provider = value.provider as AiProvider;
  const base = typeof value.baseUrl === "string" ? value.baseUrl : "";
  // Existing proxies retain their selected wire protocol and exact endpoint.
  const protocol =
    provider === "google" && base
      ? "generateContent"
      : provider === "custom" || (provider === "openai" && base)
        ? "chat"
        : defaultProtocol(provider);
  return {
    ...value,
    version: 2,
    protocol,
    structuredOutput: true,
    contextTokens: 0,
    maxOutputTokens: 8192,
  };
}
/** Adds provider-neutral reasoning control without guessing custom model support. */
export function migrateAiSettingsV2(
  value: Record<string, unknown>,
): Record<string, unknown> {
  if (
    value.version !== 2 ||
    Object.keys(value).some((key) => !v2Keys.includes(key))
  )
    throw new Error(t("ai.invalidSettings"));
  const preset = AI_MODELS.find(
    (entry) => entry.provider === value.provider && entry.id === value.model,
  );
  return {
    ...value,
    version: 3,
    reasoningEffort: preset?.reasoningEffort ?? "",
  };
}
export function normalizeShareableAiSettings(
  raw: unknown,
): Omit<AiSettings, "apiKey"> {
  if (!isRecord(raw)) throw new Error(t("ai.invalidSettings"));
  const v2 = raw.version === undefined ? migrateAiSettingsV1(raw) : raw;
  const value = v2.version === 2 ? migrateAiSettingsV2(v2) : v2;
  if (
    Object.keys(value).some((key) => !v3Keys.includes(key)) ||
    value.version !== 3 ||
    typeof value.enabled !== "boolean" ||
    !providers.includes(value.provider as AiProvider) ||
    typeof value.baseUrl !== "string" ||
    typeof value.model !== "string" ||
    !AI_PROTOCOLS.includes(value.protocol as AiSettings["protocol"]) ||
    typeof value.structuredOutput !== "boolean" ||
    typeof value.reasoningEffort !== "string"
  )
    throw new Error(t("ai.invalidSettings"));
  for (const field of [
    "batchSize",
    "contextTokens",
    "maxOutputTokens",
  ] as const)
    if (typeof value[field] !== "number" || !Number.isFinite(value[field]))
      throw new Error(t("ai.invalidSettings"));
  return {
    version: 3,
    enabled: value.enabled,
    provider: value.provider as AiProvider,
    baseUrl: value.baseUrl.trim(),
    model: value.model.trim(),
    protocol: value.protocol as AiSettings["protocol"],
    structuredOutput: value.structuredOutput,
    batchSize: Math.min(50, Math.max(1, Math.round(value.batchSize as number))),
    contextTokens: Math.max(0, Math.round(value.contextTokens as number)),
    maxOutputTokens: Math.max(256, Math.round(value.maxOutputTokens as number)),
    reasoningEffort: value.reasoningEffort.trim(),
  };
}
export function normalizeAiSettings(value: unknown): AiSettings {
  if (!isRecord(value) || typeof value.apiKey !== "string")
    throw new Error(t("ai.invalidSettings"));
  const { apiKey, ...shareable } = value;
  return { ...normalizeShareableAiSettings(shareable), apiKey };
}
export const loadAiSettings = (): AiSettings => ({ ...storedSettings });
export const isAiConfigured = (settings = loadAiSettings()) =>
  settings.enabled && Boolean(settings.apiKey.trim() && settings.model.trim());
export function getShareableAiSettings(
  settings = loadAiSettings(),
): Omit<AiSettings, "apiKey"> {
  const { apiKey: _key, ...shareable } = normalizeAiSettings(settings);
  return shareable;
}
export function restoreAiSettings(
  shareable: Omit<AiSettings, "apiKey">,
  current: AiSettings,
): AiSettings {
  return {
    ...shareable,
    apiKey:
      shareable.provider === current.provider &&
      shareable.baseUrl === current.baseUrl
        ? current.apiKey
        : "",
  };
}
export function onAiSettingsChanged(listener: (settings: AiSettings) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
async function readSettings(): Promise<AiSettings> {
  const [stored, key] = await Promise.all([
    loadFromStorage(AI_SETTINGS_KEY),
    loadFromStorage(AI_API_KEY_STORAGE_KEY),
  ]);
  let settings = getShareableAiSettings(defaultAiSettings);
  if (stored.value) {
    const parsed: unknown = JSON.parse(stored.value);
    settings = normalizeShareableAiSettings(parsed);
    if (isRecord(parsed) && parsed.version !== 3)
      await saveToStorage(AI_SETTINGS_KEY, settings);
  }
  storedSettings = { ...settings, apiKey: key.value ?? "" };
  return loadAiSettings();
}
export function loadAiSettingsState() {
  return (hydration ??= readSettings());
}
export async function whenAiSettingsReady() {
  await loadAiSettingsState();
  return loadAiSettings();
}
export function waitForAiSettingsPersistence() {
  return persistence;
}
export function saveAiSettings(settings: AiSettings) {
  storedSettings = normalizeAiSettings(settings);
  const snapshot = loadAiSettings();
  persistence = persistence
    .catch(() => undefined)
    .then(async () => {
      await Promise.all([
        saveToStorage(AI_SETTINGS_KEY, getShareableAiSettings(snapshot)),
        saveToStorage(AI_API_KEY_STORAGE_KEY, snapshot.apiKey),
      ]);
    });
  void persistence.catch(() => undefined);
  for (const listener of listeners) listener(loadAiSettings());
}
export function parseAiSettingsJson(raw: string): AiSettings {
  const parsed: unknown = JSON.parse(raw);
  if (
    !isRecord(parsed) ||
    ![1, 2, 3].includes(parsed.version as number) ||
    typeof parsed.exportedAt !== "string" ||
    !parsed.exportedAt.trim() ||
    !isRecord(parsed.settings) ||
    Object.keys(parsed).some(
      (key) => !["version", "exportedAt", "settings"].includes(key),
    )
  )
    throw new Error(t("ai.invalidSettings"));
  if (
    (parsed.version === 2 && parsed.settings.version !== 2) ||
    (parsed.version === 3 && parsed.settings.version !== 3)
  )
    throw new Error(t("ai.invalidSettings"));
  return { ...normalizeShareableAiSettings(parsed.settings), apiKey: "" };
}
export function downloadAiSettings(settings: AiSettings) {
  const payload = JSON.stringify(
    {
      version: 3,
      exportedAt: new Date().toISOString(),
      settings: getShareableAiSettings(settings),
    },
    null,
    2,
  );
  const url = URL.createObjectURL(
    new Blob([payload], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "lexiro-ai-settings.json";
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

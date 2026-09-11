import type { AiProvider, AiSettings } from "@/types";
import { AI_API_KEY_STORAGE_KEY, AI_SETTINGS_KEY } from "@/constants";
import { loadFromStorage, saveToStorage } from "@/lib/persist";
import { isRecord } from "./schema";
import { markCloudSyncPending } from "./sync-pending";

export const defaultAiSettings: AiSettings = {
  enabled: false,
  provider: "openai",
  apiKey: "",
  baseUrl: "",
  model: "gpt-4o-mini",
  batchSize: 10,
};

export interface AiGenerationOptions {
  /** Hard cap on the reply length. Defaults to an estimate from the prompt. */
  maxOutputTokens?: number;
  /**
   * Called as the reply streams in, with the characters received so far. The
   * UI only ever shows the number: the text itself is worth nothing to the user
   * until it has been parsed and validated, but a number that keeps climbing is
   * the difference between "working" and "hung".
   */
  onCharacters?: (characters: number) => void;
  responseFormat?: "json" | "text";
  signal?: AbortSignal;
  /** Set false to force the one-shot path, mostly for tests. */
  stream?: boolean;
}

/**
 * Thrown when the app cannot call the AI because it has not been set up, as
 * opposed to a request that was attempted and failed. The UI uses this to send
 * the user to settings instead of showing a request error.
 */
export class AiNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiNotConfiguredError";
  }
}

/**
 * Thrown when a request was actually attempted and came back wrong. `retryable`
 * is the point of the class: a rate limit or a dropped connection is worth
 * sending again, an invalid key or a truncated reply never is, and the batch
 * runner reads this flag instead of pattern-matching error messages.
 */
export class AiRequestError extends Error {
  readonly retryAfterMs?: number;
  readonly retryable: boolean;
  readonly status?: number;
  /** The stream itself failed, so the same request is worth trying unstreamed. */
  readonly streamBroken: boolean;

  constructor(
    message: string,
    options: {
      retryAfterMs?: number;
      retryable: boolean;
      status?: number;
      streamBroken?: boolean;
    },
  ) {
    super(message);
    this.name = "AiRequestError";
    this.retryAfterMs = options.retryAfterMs;
    this.retryable = options.retryable;
    this.status = options.status;
    this.streamBroken = options.streamBroken ?? false;
  }
}

export function isAiConfigured(
  settings: AiSettings = loadAiSettings(),
): boolean {
  return settings.enabled && Boolean(settings.apiKey.trim());
}

const AI_MIN_TIMEOUT_MS = 30_000;
const AI_MAX_TIMEOUT_MS = 180_000;
/**
 * A streamed reply is judged on silence rather than on total length: as long as
 * characters keep arriving the request is alive, however long the batch takes,
 * and a connection that goes quiet is dead well before a whole-request deadline
 * would have noticed.
 */
const AI_STREAM_IDLE_TIMEOUT_MS = 45_000;

const LEGACY_AI_SETTINGS_KEY = "lexiro-next-ai-settings";
const LEGACY_AI_API_KEY = "lexiro-next-ai-api-key";

const aiProviders: AiProvider[] = ["openai", "anthropic", "google", "custom"];
let storedSettings: AiSettings = { ...defaultAiSettings };
const settingsListeners = new Set<(settings: AiSettings) => void>();
let settingsPersistencePromise: Promise<void> = Promise.resolve();
let settingsHydration: Promise<AiSettings> | null = null;

/**
 * Resolves once stored settings have been read from IndexedDB. `LibraryHydrator`
 * starts that read for every workspace route, so this only ever waits out a race
 * between app start and the first generation.
 */
export async function whenAiSettingsReady(): Promise<AiSettings> {
  await loadAiSettingsState();
  return loadAiSettings();
}

function assertKnownSettingsKeys(
  value: Record<string, unknown>,
  includeApiKey: boolean,
): void {
  const allowed = includeApiKey
    ? ["enabled", "provider", "apiKey", "baseUrl", "model", "batchSize"]
    : ["enabled", "provider", "baseUrl", "model", "batchSize"];
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length)
    throw new Error(`AI 設定包含不支援欄位：${unknown.join("、")}`);
}

export function normalizeShareableAiSettings(
  value: unknown,
): Omit<AiSettings, "apiKey"> {
  if (!isRecord(value)) throw new Error("AI 設定格式不正確");
  assertKnownSettingsKeys(value, false);
  if (
    typeof value.enabled !== "boolean" ||
    typeof value.provider !== "string" ||
    !aiProviders.includes(value.provider as AiProvider) ||
    typeof value.baseUrl !== "string" ||
    typeof value.model !== "string" ||
    !value.model.trim() ||
    typeof value.batchSize !== "number" ||
    !Number.isFinite(value.batchSize)
  )
    throw new Error("AI 設定欄位格式錯誤");
  return {
    enabled: value.enabled,
    provider: value.provider as AiProvider,
    baseUrl: value.baseUrl,
    model: value.model.trim(),
    batchSize: Math.min(Math.max(Math.round(value.batchSize), 5), 20),
  };
}

export function normalizeAiSettings(value: unknown): AiSettings {
  if (!isRecord(value)) throw new Error("AI 設定格式不正確");
  assertKnownSettingsKeys(value, true);
  if (typeof value.apiKey !== "string") throw new Error("AI 設定欄位格式錯誤");
  return {
    ...normalizeShareableAiSettings(
      Object.fromEntries(
        Object.entries(value).filter(([key]) => key !== "apiKey"),
      ),
    ),
    apiKey: value.apiKey,
  };
}

export function loadAiSettings(): AiSettings {
  return { ...storedSettings };
}

function defaultShareableAiSettings(): Omit<AiSettings, "apiKey"> {
  return getShareableAiSettings(defaultAiSettings);
}

export function getShareableAiSettings(
  settings = loadAiSettings(),
): Omit<AiSettings, "apiKey"> {
  const { apiKey: _apiKey, ...shareable } = normalizeAiSettings(settings);
  return shareable;
}

export function onAiSettingsChanged(
  listener: (settings: AiSettings) => void,
): () => void {
  settingsListeners.add(listener);
  return () => settingsListeners.delete(listener);
}

export function loadAiSettingsState(): Promise<AiSettings> {
  settingsHydration ??= readAiSettingsState();
  return settingsHydration;
}

async function readAiSettingsState(): Promise<AiSettings> {
  const [stored, storedApiKey] = await Promise.all([
    loadFromStorage(AI_SETTINGS_KEY),
    loadFromStorage(AI_API_KEY_STORAGE_KEY),
  ]);
  let shareableSettings = defaultShareableAiSettings();
  let apiKey = storedApiKey.value ?? "";
  try {
    if (stored.value)
      shareableSettings = normalizeShareableAiSettings(
        JSON.parse(stored.value),
      );
    else if (typeof localStorage !== "undefined") {
      const legacyRaw = localStorage.getItem(LEGACY_AI_SETTINGS_KEY);
      const legacyKey = localStorage.getItem(LEGACY_AI_API_KEY) ?? "";
      if (legacyRaw) {
        const legacy = JSON.parse(legacyRaw) as Record<string, unknown>;
        shareableSettings = normalizeShareableAiSettings({
          enabled: legacy.mode === "api" || legacy.enabled === true,
          provider: legacy.provider,
          baseUrl: legacy.endpoint ?? legacy.baseUrl ?? "",
          model: legacy.model,
          batchSize: legacy.batchSize,
        });
        apiKey = legacyKey;
        await Promise.all([
          saveToStorage(AI_SETTINGS_KEY, shareableSettings),
          saveToStorage(AI_API_KEY_STORAGE_KEY, apiKey),
        ]);
        localStorage.removeItem(LEGACY_AI_SETTINGS_KEY);
        localStorage.removeItem(LEGACY_AI_API_KEY);
      }
    }
  } catch {
    shareableSettings = defaultShareableAiSettings();
  }
  storedSettings = { ...shareableSettings, apiKey };
  return loadAiSettings();
}

export async function waitForAiSettingsPersistence(): Promise<void> {
  await settingsPersistencePromise;
}

export function parseAiSettingsJson(raw: string): AiSettings {
  const parsed: unknown = JSON.parse(raw);
  if (!isRecord(parsed)) throw new Error("AI 設定必須是 object");
  if (
    Object.keys(parsed).some(
      (key) => !["version", "exportedAt", "settings"].includes(key),
    ) ||
    parsed.version !== 1 ||
    typeof parsed.exportedAt !== "string" ||
    !parsed.exportedAt.trim() ||
    !isRecord(parsed.settings)
  )
    throw new Error("AI 設定匯出格式錯誤");
  const payload = parsed.settings;
  return { ...normalizeShareableAiSettings(payload), apiKey: "" };
}

export function downloadAiSettings(settings: AiSettings): void {
  const shareableSettings = getShareableAiSettings(settings);
  const payload = JSON.stringify(
    {
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: shareableSettings,
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

export function saveAiSettings(
  settings: AiSettings,
  options: { markPending?: boolean } = {},
) {
  storedSettings = normalizeAiSettings(settings);
  const shareableSettings = getShareableAiSettings(storedSettings);
  const apiKey = storedSettings.apiKey;
  const settingsWrite = saveToStorage(AI_SETTINGS_KEY, shareableSettings);
  const apiKeyWrite = saveToStorage(AI_API_KEY_STORAGE_KEY, apiKey);
  const next = Promise.all([
    settingsPersistencePromise.catch(() => undefined),
    settingsWrite,
    apiKeyWrite,
  ]).then(() => undefined);
  settingsPersistencePromise = next;
  void next.catch(() => undefined);
  for (const listener of settingsListeners) listener(loadAiSettings());
  if (options.markPending !== false) markCloudSyncPending();
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * A twenty-word batch with example sentences legitimately takes longer than a
 * five-word one, so the deadline grows with the prompt instead of cutting the
 * slowest — and most expensive — requests off at a flat minute.
 */
function requestTimeoutMs(prompt: string): number {
  return Math.min(
    AI_MAX_TIMEOUT_MS,
    AI_MIN_TIMEOUT_MS + Math.ceil(prompt.length / 500) * 2_000,
  );
}

/** The reply is about as long as the words it describes, with room to spare. */
function estimateMaxOutputTokens(prompt: string): number {
  return Math.min(8_192, Math.max(2_048, Math.ceil(prompt.length / 2) + 1_024));
}

function isRetryableStatus(status: number): boolean {
  return status >= 500 || [408, 409, 425, 429].includes(status);
}

function readRetryAfterMs(response: Response): number | undefined {
  const header = response.headers.get("retry-after");
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
  const date = Date.parse(header);
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}

/**
 * Error bodies are not always JSON: a proxy or gateway in front of the provider
 * answers 502 with HTML, and reading that as JSON used to throw away the only
 * clue the user had.
 */
function errorDetail(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return "";
  try {
    const payload: unknown = JSON.parse(trimmed);
    const error = isRecord(payload) ? payload.error : undefined;
    if (typeof error === "string") return error;
    if (isRecord(error) && typeof error.message === "string")
      return error.message;
    if (isRecord(payload) && typeof payload.message === "string")
      return payload.message;
    return "";
  } catch {
    return trimmed.replace(/<[^>]*>/gu, " ").replace(/\s+/gu, " ").trim().slice(0, 200);
  }
}

function openAiUrl(settings: AiSettings) {
  return (
    settings.baseUrl.trim() || "https://api.openai.com/v1/chat/completions"
  );
}

/** What a provider said about why it stopped, in one vocabulary. */
type StopReason = "blocked" | "complete" | "truncated" | "unknown";

function normalizeStopReason(
  provider: AiProvider,
  value: unknown,
): StopReason {
  if (typeof value !== "string") return "unknown";
  if (provider === "anthropic") {
    if (value === "max_tokens") return "truncated";
    if (value === "refusal") return "blocked";
    return "complete";
  }
  if (provider === "google") {
    if (value === "MAX_TOKENS") return "truncated";
    if (["SAFETY", "RECITATION", "PROHIBITED_CONTENT", "BLOCKLIST"].includes(value))
      return "blocked";
    return "complete";
  }
  if (value === "length") return "truncated";
  if (value === "content_filter") return "blocked";
  return "complete";
}

/**
 * Gemini carries the model in the path, so a custom base URL used to silently
 * drop `settings.model` and run whatever the other end defaulted to. A base
 * that already names an endpoint is respected; anything else is treated as an
 * API root to hang the model off.
 */
function googleUrl(settings: AiSettings, stream: boolean) {
  const method = stream ? "streamGenerateContent?alt=sse" : "generateContent";
  const model = `models/${encodeURIComponent(settings.model)}:${method}`;
  const base = settings.baseUrl.trim();
  if (!base) return `https://generativelanguage.googleapis.com/v1beta/${model}`;
  // An endpoint the user spelled out in full is used exactly as given, which is
  // also why Gemini through such a proxy is not streamed: the method name is
  // part of the path and we are not going to rewrite someone else's URL.
  if (base.includes("generateContent")) return base;
  return `${base.replace(/\/+$/u, "")}/${model}`;
}

function canStream(settings: AiSettings): boolean {
  if (settings.provider !== "google") return true;
  return !settings.baseUrl.trim().includes("generateContent");
}

interface AiRequest {
  body: Record<string, unknown>;
  headers: Record<string, string>;
  url: string;
}

function buildAiRequest(
  settings: AiSettings,
  prompt: string,
  options: {
    jsonField: boolean;
    maxOutputTokens: number;
    responseFormat: "json" | "text";
    stream: boolean;
  },
): AiRequest {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (settings.provider === "anthropic")
    return {
      body: {
        model: settings.model,
        max_tokens: options.maxOutputTokens,
        messages: [{ role: "user", content: prompt }],
        ...(options.stream ? { stream: true } : {}),
      },
      headers: {
        ...headers,
        "x-api-key": settings.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      url: settings.baseUrl.trim() || "https://api.anthropic.com/v1/messages",
    };

  if (settings.provider === "google")
    return {
      body: {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        ...(options.responseFormat === "json"
          ? { generationConfig: { responseMimeType: "application/json" } }
          : {}),
      },
      headers: { ...headers, "x-goog-api-key": settings.apiKey },
      url: googleUrl(settings, options.stream),
    };

  return {
    body: {
      model: settings.model,
      messages: [{ role: "user", content: prompt }],
      ...(options.jsonField
        ? { response_format: { type: "json_object" } }
        : {}),
      ...(options.stream ? { stream: true } : {}),
    },
    headers: { ...headers, Authorization: `Bearer ${settings.apiKey}` },
    url: openAiUrl(settings),
  };
}

interface AiReply {
  /** The provider said, in its own vocabulary, that the reply was finished. */
  complete: boolean;
  stopReason: StopReason;
  text: string;
}

/** One SSE `data:` payload, in whichever shape the provider sends. */
function readStreamPayload(
  provider: AiProvider,
  payload: Record<string, unknown>,
): { complete?: boolean; stopReason?: StopReason; text?: string } {
  if (isRecord(payload.error)) {
    const message = normalizeText(payload.error.message) || "AI 串流中斷";
    // A mid-stream error is the provider's own hiccup — overload, a dropped
    // upstream — which is exactly the case retrying exists for.
    throw new AiRequestError(`AI 請求失敗：${message}`, { retryable: true });
  }

  if (provider === "anthropic") {
    if (payload.type === "content_block_delta" && isRecord(payload.delta))
      return { text: normalizeText(payload.delta.text) };
    if (payload.type === "message_delta" && isRecord(payload.delta))
      return {
        complete: true,
        stopReason: normalizeStopReason(provider, payload.delta.stop_reason),
      };
    if (payload.type === "message_stop") return { complete: true };
    return {};
  }

  if (provider === "google") {
    if (isRecord(payload.promptFeedback) && payload.promptFeedback.blockReason)
      return { complete: true, stopReason: "blocked" };
    const candidate = Array.isArray(payload.candidates)
      ? payload.candidates[0]
      : undefined;
    if (!isRecord(candidate)) return {};
    const parts = isRecord(candidate.content)
      ? candidate.content.parts
      : undefined;
    const text = Array.isArray(parts)
      ? parts
          .map((item) => normalizeText((item as Record<string, unknown>).text))
          .join("")
      : "";
    if (candidate.finishReason)
      return {
        complete: true,
        stopReason: normalizeStopReason(provider, candidate.finishReason),
        text,
      };
    return { text };
  }

  const choice = Array.isArray(payload.choices) ? payload.choices[0] : undefined;
  if (!isRecord(choice)) return {};
  const delta = isRecord(choice.delta) ? choice.delta : undefined;
  const text = normalizeText(delta?.content);
  if (choice.finish_reason)
    return {
      complete: true,
      stopReason: normalizeStopReason(provider, choice.finish_reason),
      text,
    };
  return { text };
}

/**
 * Reads a server-sent-events reply, handing the running character count back as
 * it goes. Every chunk also resets the idle deadline, so a batch that genuinely
 * takes three minutes is never cut off while it is still producing, and one that
 * quietly dies is noticed in well under one.
 */
async function readAiStream(
  provider: AiProvider,
  body: ReadableStream<Uint8Array>,
  options: { bump: () => void; onCharacters?: (characters: number) => void },
): Promise<AiReply> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let complete = false;
  let stopReason: StopReason = "unknown";

  const consume = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return;
    const data = trimmed.slice(5).trim();
    if (!data) return;
    if (data === "[DONE]") {
      complete = true;
      return;
    }
    let payload: unknown;
    try {
      payload = JSON.parse(data);
    } catch {
      return; // a keep-alive or a comment, not a chunk
    }
    if (!isRecord(payload)) return;
    const chunk = readStreamPayload(provider, payload);
    if (chunk.text) {
      text += chunk.text;
      options.onCharacters?.(text.length);
    }
    if (chunk.stopReason) stopReason = chunk.stopReason;
    if (chunk.complete) complete = true;
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    options.bump();
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) consume(line);
  }
  consume(buffer);

  return { complete, stopReason, text };
}

function readWholeReply(
  provider: AiProvider,
  data: Record<string, unknown>,
): AiReply {
  if (provider === "anthropic") {
    const content = Array.isArray(data.content) ? data.content : [];
    return {
      complete: true,
      stopReason: normalizeStopReason(provider, data.stop_reason),
      text: content
        .map((item) => normalizeText((item as Record<string, unknown>).text))
        .join(""),
    };
  }

  if (provider === "google") {
    const feedback = isRecord(data.promptFeedback) ? data.promptFeedback : null;
    const candidates = Array.isArray(data.candidates) ? data.candidates : [];
    const candidate = isRecord(candidates[0]) ? candidates[0] : null;
    const parts = isRecord(candidate?.content)
      ? candidate.content.parts
      : undefined;
    return {
      complete: true,
      stopReason:
        feedback && typeof feedback.blockReason === "string"
          ? "blocked"
          : normalizeStopReason(provider, candidate?.finishReason),
      text: Array.isArray(parts)
        ? parts
            .map((item) => normalizeText((item as Record<string, unknown>).text))
            .join("")
        : "",
    };
  }

  const choices = Array.isArray(data.choices) ? data.choices : [];
  const choice = isRecord(choices[0]) ? choices[0] : null;
  const message = isRecord(choice?.message) ? choice.message : undefined;
  const text =
    typeof message?.content === "string"
      ? message.content
      : Array.isArray(message?.content)
        ? message.content
            .map((item) =>
              normalizeText((item as Record<string, unknown>).text ?? item),
            )
            .join("")
        : typeof data.output_text === "string"
          ? data.output_text
          : "";
  return {
    complete: true,
    stopReason: normalizeStopReason(provider, choice?.finish_reason),
    text,
  };
}

async function sendAiRequest(
  request: AiRequest,
  options: {
    onCharacters?: (characters: number) => void;
    provider: AiProvider;
    signal?: AbortSignal;
    stream: boolean;
    timeoutMs: number;
  },
): Promise<AiReply> {
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort(options.signal?.reason);
  options.signal?.addEventListener("abort", abortFromCaller, { once: true });
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const arm = (ms: number) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, ms);
  };
  arm(options.timeoutMs);
  let streaming = false;

  try {
    const response = await fetch(request.url, {
      method: "POST",
      headers: request.headers,
      body: JSON.stringify(request.body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = errorDetail(await response.text());
      throw new AiRequestError(
        `AI 請求失敗（${response.status}）${detail ? `：${detail}` : ""}`,
        {
          retryAfterMs: readRetryAfterMs(response),
          retryable: isRetryableStatus(response.status),
          status: response.status,
        },
      );
    }

    streaming =
      options.stream &&
      Boolean(response.body) &&
      (response.headers.get("content-type") ?? "").includes("text/event-stream");

    if (streaming) {
      arm(AI_STREAM_IDLE_TIMEOUT_MS);
      const reply = await readAiStream(options.provider, response.body!, {
        bump: () => arm(AI_STREAM_IDLE_TIMEOUT_MS),
        onCharacters: options.onCharacters,
      });
      // The socket closed without the provider ever saying it was finished, so
      // whatever arrived is half a reply — worth sending again rather than
      // handing a truncated document to the parser.
      if (!reply.complete)
        throw new AiRequestError("AI 回覆在完成前中斷，請再試一次。", {
          retryable: true,
          streamBroken: true,
        });
      return reply;
    }

    // Reading the body happens under the same deadline as the request itself.
    // A server that sends headers and then stalls used to hang the run forever,
    // because the timer was cleared the moment `fetch` resolved.
    const text = await response.text();
    const data: unknown = JSON.parse(text) as unknown;
    if (!isRecord(data))
      throw new AiRequestError("AI 回覆的格式不正確。", { retryable: true });
    const reply = readWholeReply(options.provider, data);
    options.onCharacters?.(reply.text.length);
    return reply;
  } catch (reason) {
    if (options.signal?.aborted) throw reason;
    if (timedOut)
      throw new AiRequestError(
        streaming
          ? `AI 回覆停了 ${Math.round(AI_STREAM_IDLE_TIMEOUT_MS / 1_000)} 秒沒有新內容，請再試一次。`
          : `AI 請求逾時（${Math.round(options.timeoutMs / 1_000)} 秒），請稍後再試，或到設定調小每批數量。`,
        { retryable: true },
      );
    if (reason instanceof AiRequestError) throw reason;
    if (reason instanceof SyntaxError)
      throw new AiRequestError("AI 回覆不是有效的 JSON。", { retryable: true });
    throw new AiRequestError(
      reason instanceof Error ? reason.message : String(reason),
      { retryable: true },
    );
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", abortFromCaller);
  }
}

/**
 * Turns a finished reply into the text a caller may parse, or into the reason it
 * must not. A reply cut short by the token ceiling used to surface downstream as
 * "格式錯誤" and get retried into the same ceiling twice.
 */
function assertUsableReply(reply: AiReply): string {
  if (reply.stopReason === "truncated")
    throw new AiRequestError("AI 回覆被截斷，請到設定調小每批數量後再試。", {
      retryable: false,
    });
  if (reply.stopReason === "blocked")
    throw new AiRequestError("AI 拒絕回覆這批內容，請調整或移除其中的字詞。", {
      retryable: false,
    });
  if (!reply.text.trim())
    throw new AiRequestError("AI 回了空白內容，請再試一次。", {
      retryable: true,
    });
  return reply.text;
}

/** An OpenAI-compatible gateway that does not know `response_format`. */
function rejectedJsonField(reason: unknown): boolean {
  return (
    reason instanceof AiRequestError &&
    reason.status === 400 &&
    /response_format|json_object|json_schema/iu.test(reason.message)
  );
}

/** A gateway that advertises the OpenAI shape but cannot stream it. */
function rejectedStream(reason: unknown): boolean {
  if (!(reason instanceof AiRequestError)) return false;
  if (reason.streamBroken) return true;
  return reason.status === 400 && /stream/iu.test(reason.message);
}

export async function generateWithAi(
  settings: AiSettings,
  prompt: string,
  options: AiGenerationOptions = {},
): Promise<string> {
  if (!settings.enabled) throw new AiNotConfiguredError("尚未開啟直接呼叫 API");
  if (!settings.apiKey.trim())
    throw new AiNotConfiguredError("尚未填入 API key");

  const provider: AiProvider = settings.provider;
  const responseFormat = options.responseFormat ?? "json";
  const maxOutputTokens =
    options.maxOutputTokens ?? estimateMaxOutputTokens(prompt);
  const timeoutMs = requestTimeoutMs(prompt);
  // A self-hosted OpenAI-compatible gateway speaks the OpenAI shape without
  // necessarily accepting `response_format`, so asking for JSON is worth one
  // 400 and a plain retry rather than never asking at all.
  let jsonField =
    responseFormat === "json" &&
    (provider === "openai" || provider === "custom");
  // Streaming is how a request proves it is still alive. The reply is assembled
  // and parsed exactly as before — only the character count reaches the UI —
  // but the run can now tell a slow batch from a dead socket.
  let stream = (options.stream ?? true) && canStream(settings);

  const send = () =>
    sendAiRequest(
      buildAiRequest(settings, prompt, {
        jsonField,
        maxOutputTokens,
        responseFormat,
        stream,
      }),
      {
        onCharacters: options.onCharacters,
        provider,
        signal: options.signal,
        stream,
        timeoutMs,
      },
    );

  // Each fallback flips one flag and only once, so this settles in at most three
  // attempts: a gateway that cannot stream, or cannot be asked for JSON, is
  // still worth talking to on its own terms.
  for (;;) {
    try {
      return assertUsableReply(await send());
    } catch (reason) {
      if (stream && rejectedStream(reason)) {
        stream = false;
        continue;
      }
      if (jsonField && rejectedJsonField(reason)) {
        jsonField = false;
        continue;
      }
      throw reason;
    }
  }
}

/**
 * Calls the AI with the settings already in memory. Settings are hydrated once
 * by `loadAiSettingsState()` at startup, so a run of twenty batched requests no
 * longer re-reads IndexedDB twenty times.
 */
export async function generateWithSavedAi(
  prompt: string,
  options: AiGenerationOptions = {},
): Promise<string> {
  return generateWithAi(await whenAiSettingsReady(), prompt, options);
}

export function extractJsonText(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/iu);
  if (fenced?.[1]) return fenced[1].trim();
  const trimmed = text.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return trimmed;
  const objectStart = text.indexOf("{");
  const objectEnd = text.lastIndexOf("}");
  if (objectStart >= 0 && objectEnd > objectStart)
    return text.slice(objectStart, objectEnd + 1);
  const arrayStart = text.indexOf("[");
  const arrayEnd = text.lastIndexOf("]");
  if (arrayStart >= 0 && arrayEnd > arrayStart)
    return text.slice(arrayStart, arrayEnd + 1);
  return trimmed;
}

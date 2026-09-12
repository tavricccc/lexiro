import { getFirebaseAuth } from "@/src/lib/firebase";
import { AiRequestError } from "@/src/lib/ai/errors";
import type { AiSession, AiTurnOptions, AiTurnResult } from "@/src/types/ai";
import type { AccountInfo, GenerationInput } from "@lexiro/ai-contract";
import { t, type TranslationKey } from "./i18n";

export const MANAGED_ACCOUNT_CHANGED = "lexiro:managed-account-changed";
export function notifyManagedAccountChanged() {
  window.dispatchEvent(new Event(MANAGED_ACCOUNT_CHANGED));
}
const messages: Record<number, TranslationKey> = {
  401: "managed.signInRequired",
  402: "managed.noPoints",
  409: "managed.inProgress",
  413: "managed.inputLimit",
  429: "managed.rateLimited",
  503: "managed.unavailable",
};

export async function managedFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  init = {
    ...init,
    signal: AbortSignal.any([
      ...(init.signal ? [init.signal] : []),
      AbortSignal.timeout(120_000),
    ]),
  };
  const base = process.env.NEXT_PUBLIC_AI_WORKER_URL;
  if (!base)
    throw new AiRequestError(t("managed.unavailable"), { retryable: false });
  const auth = getFirebaseAuth();
  if (!auth)
    throw new AiRequestError(t("managed.signInRequired"), {
      status: 401,
      retryable: false,
    });
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user)
    throw new AiRequestError(t("managed.signInRequired"), {
      status: 401,
      retryable: false,
    });
  const uid = user.uid;
  for (let attempt = 0; attempt < 2; attempt++) {
    init.signal?.throwIfAborted();
    const token = await user.getIdToken(attempt === 1);
    if (auth.currentUser?.uid !== uid)
      throw new DOMException("Account changed", "AbortError");
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    let response: Response;
    try {
      response = await fetch(`${base.replace(/\/$/, "")}${path}`, {
        ...init,
        headers,
      });
    } catch (reason) {
      if (init.signal?.aborted) throw init.signal.reason;
      throw new AiRequestError(t("managed.unavailable"), {
        retryable: true,
        code: reason instanceof TypeError ? "network" : "request_failed",
      });
    }
    if (auth.currentUser?.uid !== uid) {
      await response.body?.cancel();
      throw new DOMException("Account changed", "AbortError");
    }
    if (response.status === 401 && attempt === 0) {
      await response.body?.cancel();
      continue;
    }
    if (!response.ok) {
      let code: string | undefined;
      try {
        const body = await response.json();
        code =
          typeof body?.error?.code === "string" ? body.error.code : undefined;
      } catch {
        /* Public errors never display upstream text. */
      }
      const retryAfter = response.headers.get("retry-after");
      const seconds = retryAfter === null ? NaN : Number(retryAfter);
      const retryAfterMs =
        retryAfter === null
          ? undefined
          : Number.isFinite(seconds)
            ? Math.max(0, seconds * 1000)
            : Math.max(0, Date.parse(retryAfter) - Date.now());
      throw new AiRequestError(
        t(
          code === "account_exists"
            ? "managed.accountExists"
            : code === "retry_limit" ? "managed.retryLimit" : (messages[response.status] ?? "managed.failed"),
        ),
        {
          status: response.status,
          code,
          retryAfterMs: Number.isFinite(retryAfterMs)
            ? retryAfterMs
            : undefined,
          retryable: code !== "retry_limit" && (response.status === 429 || response.status >= 500),
        },
      );
    }
    return response;
  }
  throw new AiRequestError(t("managed.signInRequired"), {
    status: 401,
    retryable: false,
  });
}

export async function managedJson<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await managedFetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  return response.json() as Promise<T>;
}
export const getManagedAccount = () => managedJson<AccountInfo>("/me");

export async function readManagedStream(
  response: Response,
  options: AiTurnOptions,
): Promise<AiTurnResult> {
  if (!response.body)
    throw new AiRequestError(t("ai.emptyReply"), { retryable: true });
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  let buffer = "",
    text = "",
    id: string | undefined,
    complete = false;
  const terminal: { stopReason: AiTurnResult["stopReason"] } = {
    stopReason: "unknown",
  };
  const consume = (frame: string) => {
    const dataText = frame
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!dataText || dataText === "[DONE]") return;
    const data = JSON.parse(dataText);
    if (data.type === "response.created") id = data.response.id;
    if (data.type === "response.output_text.delta") {
      text += data.delta;
      options.onCharacters?.(text.length);
      options.onPhase?.("generating");
    }
    if (data.type === "error" || data.type === "response.failed")
      throw new AiRequestError(t("managed.failed"), { retryable: true });
    if (data.type === "response.completed") {
      complete = true;
      terminal.stopReason = "complete";
    }
    if (data.type === "response.incomplete") {
      complete = true;
      terminal.stopReason =
        data.response.incomplete_details?.reason === "max_output_tokens"
          ? "truncated"
          : "blocked";
    }
  };
  try {
    for (;;) {
      options.signal?.throwIfAborted();
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let match: RegExpExecArray | null;
      while ((match = /\r?\n\r?\n/.exec(buffer))) {
        consume(buffer.slice(0, match.index));
        buffer = buffer.slice(match.index + match[0].length);
      }
      if (done) break;
    }
  } finally {
    await reader.cancel();
    reader.releaseLock();
    notifyManagedAccountChanged();
  }
  if (!complete)
    throw new AiRequestError(t("ai.streamFailed"), {
      retryable: true,
      streamBroken: true,
    });
  const { stopReason } = terminal;
  if (stopReason === "truncated")
    throw new AiRequestError(t("ai.truncated"), {
      code: "truncated",
      retryable: false,
    });
  if (stopReason === "blocked")
    throw new AiRequestError(t("ai.blocked"), {
      code: "blocked",
      retryable: false,
    });
  if (!text.trim())
    throw new AiRequestError(t("ai.emptyReply"), { retryable: false });
  return { text, id, complete, stopReason };
}

export async function managedTurn(
  session: AiSession,
  input: GenerationInput,
  options: AiTurnOptions = {},
): Promise<AiTurnResult> {
  options.onPhase?.("connecting");
  const signal = AbortSignal.any([
    ...(options.signal ? [options.signal] : []),
    AbortSignal.timeout(120_000),
  ]);
  const response = await managedFetch(
    input.kind === "organizeText" ? "/organize" : "/generate",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({
        ...input,
        session: session.sessionId,
        tier: session.tier,
        cursor: session.cursor,
        repair: options.repair,
        newVersion: session.append,
      }),
    },
  );
  if (response.headers.get("x-context-rebuilt") === "1") {
    session.cursor = undefined;
    session.notices.push(t("ai.contextRebuilt"));
  }
  return readManagedStream(response, { ...options, signal });
}

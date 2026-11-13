import { appCheckHeaders } from "./app-check";
import { idToken } from "./auth";
import { workerUrl } from "./config";

/** A Worker refusal or a failed request, with a message fit to show. */
export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
  /** No network: the request never reached the Worker. */
  get offline() { return this.status === 0; }
}

const MESSAGES: Record<string, string> = {
  offline: "目前離線，連線後再試一次。",
  unauthorized: "登入已過期，請重新登入。",
  daily_write_limit: "今天的寫入量已達上限，明天 08:00 會重置。",
  daily_read_limit: "今天的讀取量已達上限，明天 08:00 會重置。",
  rate_limited: "操作太頻繁了，請稍候一分鐘。",
  account_disabled: "這個帳號已被停用。",
  set_not_found: "找不到這個單字集，可能已被刪除。",
  word_not_found: "找不到這個單字，可能已被刪除。",
  duplicate_word: "這個單字集已經有同樣拼法的單字。",
  set_word_limit: "一個單字集最多 2000 個單字。",
  set_question_limit: "一個單字集最多 1000 題。",
  share_unavailable: "這個分享連結已失效。",
  recent_sign_in_required: "請重新登入後再刪除帳號。",
  forbidden: "沒有權限。",
  room_not_found: "找不到這個房間。",
  room_full: "房間已滿。",
  room_ended: "這場對戰已經結束。",
};

export function errorMessage(reason: unknown): string {
  if (reason instanceof ApiError) return reason.message;
  if (reason instanceof Error && reason.message) return reason.message;
  return "發生錯誤，請再試一次。";
}

/**
 * A JSON request to the Worker as the signed-in user. A rejected token is
 * refreshed once; `auth: false` sends no token (public reads).
 */
export async function api<T>(path: string, init: RequestInit & { auth?: boolean; json?: unknown } = {}): Promise<T> {
  const { auth = true, json, ...rest } = init;
  for (let attempt = 0; attempt < 2; attempt++) {
    const headers = new Headers(rest.headers);
    if (json !== undefined) headers.set("Content-Type", "application/json");
    if (auth) {
      const token = await idToken(attempt > 0);
      if (!token) throw new ApiError(401, "unauthorized", MESSAGES.unauthorized);
      headers.set("Authorization", `Bearer ${token}`);
      for (const [name, value] of Object.entries(await appCheckHeaders())) headers.set(name, value);
    }
    let response: Response;
    try {
      response = await fetch(`${workerUrl}${path}`, {
        ...rest,
        headers,
        body: json !== undefined ? JSON.stringify(json) : rest.body,
        cache: "no-store",
        signal: rest.signal ?? AbortSignal.timeout(30_000),
      });
    } catch {
      throw new ApiError(0, "offline", MESSAGES.offline);
    }
    if (response.status === 401 && auth && attempt === 0) continue;
    const body = await response.json().catch(() => null) as { error?: { code?: string; message?: string } } | null;
    if (!response.ok) {
      const code = body?.error?.code ?? "unavailable";
      throw new ApiError(response.status, code, MESSAGES[code] ?? body?.error?.message ?? "伺服器暫時無法使用，請稍後再試。");
    }
    return body as T;
  }
  throw new ApiError(401, "unauthorized", MESSAGES.unauthorized);
}

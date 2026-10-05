import { HttpError } from "./http";

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Only diagnostic fields leave the server, and only for verified administrators. */
export function upstreamDiagnostic(value: unknown, context: Record<string, unknown>, secret: string) {
  const error = record(value) && record(value.error) ? value.error : value;
  const provider: Record<string, string> = {};
  if (record(error)) {
    for (const key of ["code", "message", "param", "type"]) {
      if (typeof error[key] === "string") {
        const message = error[key].slice(0, 8000);
        provider[key] = secret ? message.replaceAll(secret, "[redacted]") : message;
      }
    }
  }
  return { ...context, ...(Object.keys(provider).length ? { provider } : {}) };
}

export class UpstreamError extends HttpError {
  constructor(public diagnostic: Record<string, unknown>, status = 500, retryAfter?: string) {
    super(status, "upstream_unavailable", undefined, retryAfter);
  }
}

export async function upstreamFailure(response: Response, context: Record<string, unknown>, secret: string) {
  let body: unknown;
  try { body = await response.json(); } catch { body = undefined; }
  return new UpstreamError(upstreamDiagnostic(body, {
    ...context, status: response.status, requestId: response.headers.get("x-request-id"),
  }, secret), response.status === 429 ? 429 : response.status >= 500 ? 503 : 500,
  response.headers.get("retry-after") ?? undefined);
}

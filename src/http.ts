export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    public field?: string,
    public retryAfter?: string,
  ) {
    super(code);
  }
}
/** An HttpError whose message tells the caller the exact cause and location. */
export function httpError(status: number, code: string, message: string) {
  const error = new HttpError(status, code);
  error.message = message;
  return error;
}
export async function readBody(
  request: Request,
  limit: number,
): Promise<string> {
  const length = request.headers.get("content-length");
  if (length && Number(length) > limit)
    throw new HttpError(413, "input_limit", "body");
  if (!request.body) throw new HttpError(400, "invalid_input");
  const reader = request.body.getReader(),
    parts: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) throw new HttpError(413, "input_limit", "body");
      parts.push(value);
    }
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const part of parts) {
    bytes.set(part, at);
    at += part.length;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}
export const fingerprint = async (value: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  )
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
type Issue = { path?: PropertyKey[]; message?: string };
// Flatten zod issues (or a zod-style JSON message) into "path: reason; ..." for LLM clients.
export function issueText(reason: unknown, fallback = "Invalid input"): string {
  let issues: Issue[] | undefined;
  if (
    reason &&
    typeof reason === "object" &&
    Array.isArray((reason as { issues?: unknown }).issues)
  )
    issues = (reason as { issues: Issue[] }).issues;
  const message =
    reason instanceof Error
      ? reason.message
      : typeof reason === "string"
        ? reason
        : "";
  if (!issues && message.trimStart().startsWith("["))
    try {
      const parsed = JSON.parse(message);
      if (Array.isArray(parsed)) issues = parsed as Issue[];
    } catch {
      /* plain message */
    }
  if (!issues?.length) return message || fallback;
  const text = issues
    .slice(0, 5)
    .map(
      (issue) =>
        `${issue.path?.length ? `${issue.path.map(String).join(".")}: ` : ""}${issue.message ?? "invalid format"}`,
    )
    .join("; ");
  return issues.length > 5 ? `${text}; ${issues.length - 5} more` : text;
}

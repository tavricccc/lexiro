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

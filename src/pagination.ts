import { z } from "zod";
import { HttpError } from "./http";

export const accountCursor = z.strictObject({
  v: z.literal(1), page: z.literal("accounts"),
  email: z.string().max(320), uid: z.string().min(1).max(128),
});
export const usageCursor = z.strictObject({
  v: z.literal(1), page: z.literal("usage"),
  createdAt: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  id: z.string().min(1).max(128),
});

export function readCursor<T>(request: Request, schema: z.ZodType<T>): T | undefined {
  const params = new URL(request.url).searchParams;
  if (params.has("offset")) throw new HttpError(400, "invalid_input", "cursor");
  const cursor = params.get("cursor");
  if (cursor === null) return;
  if (cursor.length > 2048 || !/^[A-Za-z0-9_-]+$/.test(cursor))
    throw new HttpError(400, "invalid_input", "cursor");
  try {
    const bytes = Uint8Array.from(atob(cursor.replaceAll("-", "+").replaceAll("_", "/")), (char) => char.charCodeAt(0));
    return schema.parse(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)));
  } catch {
    throw new HttpError(400, "invalid_input", "cursor");
  }
}

export function encodeCursor(value: z.infer<typeof accountCursor> | z.infer<typeof usageCursor>): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

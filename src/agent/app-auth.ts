import type { D1Database } from "@cloudflare/workers-types";
import { z } from "zod";
import { HttpError, readBody } from "../http";

// The native app cannot run the Google popup itself, so the web app signs in
// and hands the Google ID token over through a one-time code (PKCE, S256). The
// code alone is useless: redeeming it needs the verifier that never left the
// app, so a redirect intercepted by another app gains nothing.
export const APP_AUTH_CODE_TTL_MS = 60_000;
export const APP_AUTH_PURGE_SQL = "DELETE FROM app_auth_codes WHERE expires_at<?";

const base64url = z.string().regex(/^[A-Za-z0-9_-]+$/);
const issueInput = z.object({
  challenge: base64url.length(43),
  googleIdToken: z.string().min(20).max(4096).regex(/^[\w-]+\.[\w-]+\.[\w-]+$/),
});
const redeemInput = z.object({
  code: base64url.length(43),
  verifier: base64url.min(43).max(128),
});

function encode(bytes: ArrayBuffer | Uint8Array): string {
  let text = "";
  for (const byte of new Uint8Array(bytes)) text += String.fromCharCode(byte);
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256(value: string): Promise<string> {
  return encode(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
}

/** Signed-in web app: stores the token behind a fresh code. */
export async function issueAppAuthCode(
  request: Request,
  db: D1Database,
  uid: string,
  now: number,
): Promise<Response> {
  const input = issueInput.parse(JSON.parse(await readBody(request, 6000)));
  const code = encode(crypto.getRandomValues(new Uint8Array(32)));
  // Only the hash is stored, so a read of the table cannot redeem anything.
  await db
    .prepare(
      "INSERT INTO app_auth_codes(code_hash,challenge,uid,google_id_token,expires_at) VALUES(?,?,?,?,?)",
    )
    .bind(
      await sha256(code),
      input.challenge,
      uid,
      input.googleIdToken,
      now + APP_AUTH_CODE_TTL_MS,
    )
    .run();
  return Response.json({ code }, { status: 201 });
}

/** Native app: trades code + verifier for the token, exactly once. */
export async function redeemAppAuthCode(
  request: Request,
  db: D1Database,
  now: number,
): Promise<Response> {
  const input = redeemInput.parse(JSON.parse(await readBody(request, 1000)));
  // DELETE ... RETURNING makes redemption single-use even under a race.
  const row = await db
    .prepare(
      "DELETE FROM app_auth_codes WHERE code_hash=? RETURNING challenge,google_id_token,expires_at",
    )
    .bind(await sha256(input.code))
    .first<{ challenge: string; google_id_token: string; expires_at: number }>();
  if (
    !row ||
    row.expires_at < now ||
    row.challenge !== (await sha256(input.verifier))
  )
    throw new HttpError(400, "invalid_grant");
  return Response.json({ googleIdToken: row.google_id_token });
}

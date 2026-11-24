import { createLocalJWKSet, jwtVerify, type JSONWebKeySet } from "jose";
import { HttpError } from "./http";

export const APP_CHECK_JWKS_URL =
  "https://firebaseappcheck.googleapis.com/v1/jwks";

export type AppCheckMode = "off" | "monitor" | "enforce";

/** Only the two config values this boundary reads, shared by both Workers. */
export interface AppCheckConfig {
  FIREBASE_PROJECT_NUMBER?: string;
  APP_CHECK_MODE?: string;
}

/** Fallback key-cache lifetime when Google sends no usable max-age (5 minutes). */
const MIN_JWKS_CACHE_MS = 300_000;

export class AppCheckVerificationError extends Error {
  constructor() {
    super("app_check_failed");
  }
}

/** Anything other than the two known values (including absent) means off. */
export function appCheckMode(value: string | undefined): AppCheckMode {
  return value === "monitor" || value === "enforce" ? value : "off";
}

/**
 * Same key-cache policy as `src/auth.ts`: honour an advertised max-age minus
 * the upstream Age, and never cache for less than five minutes when Google
 * omits it. The App Check JWKS is one global URL, so one cache per isolate
 * (keyed by the fetcher it was built with) is enough.
 */
interface JwksState {
  keys?: ReturnType<typeof createLocalJWKSet>;
  expires: number;
  pending?: Promise<ReturnType<typeof createLocalJWKSet>>;
}
const jwksStates = new WeakMap<typeof fetch, JwksState>();

async function loadKeys(fetcher: typeof fetch, state: JwksState) {
  const response = await fetcher(APP_CHECK_JWKS_URL, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new AppCheckVerificationError();
  const data = await response.json() as JSONWebKeySet;
  const resolver = createLocalJWKSet(data);
  const match = /(?:^|,)\s*max-age=(\d+)(?:\s|,|$)/i.exec(
    response.headers.get("cache-control") ?? "",
  );
  const advertised = match ? Number(match[1]) : Number.NaN;
  const age = Number(response.headers.get("age") ?? 0);
  const lifetime = Number.isFinite(advertised) && advertised > 0
    ? Math.max(0, advertised - (Number.isFinite(age) ? age : 0)) * 1000
    : MIN_JWKS_CACHE_MS;
  state.keys = resolver;
  state.expires = Date.now() + lifetime;
  return resolver;
}

function appCheckKeys(fetcher: typeof fetch) {
  const state = jwksStates.get(fetcher) ?? { expires: 0 };
  jwksStates.set(fetcher, state);
  if (state.keys && state.expires > Date.now()) return Promise.resolve(state.keys);
  if (!state.pending) {
    state.pending = loadKeys(fetcher, state).finally(() => {
      state.pending = undefined;
    });
  }
  return state.pending;
}

/**
 * Verify a Firebase App Check token. RS256 only, with the issuer, audience,
 * expiry and a non-empty subject checked before the token is accepted. This is
 * real signature verification, never a decode-only check.
 */
export async function verifyAppCheck(
  token: string,
  projectNumber: string,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  // App Check tokens are small; reject oversized input before any crypto or
  // JWKS fetch, mirroring the Firebase ID token boundary.
  if (!token || token.length > 16_384 || !projectNumber)
    throw new AppCheckVerificationError();
  const issuer = `https://firebaseappcheck.googleapis.com/${projectNumber}`;
  const audience = `projects/${projectNumber}`;
  try {
    const { payload } = await jwtVerify(token, await appCheckKeys(fetcher), {
      algorithms: ["RS256"],
      issuer,
      audience,
      requiredClaims: ["sub", "exp"],
    });
    const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!audiences.includes(audience) ||
        typeof payload.sub !== "string" || !payload.sub.trim())
      throw new AppCheckVerificationError();
  } catch {
    throw new AppCheckVerificationError();
  }
}

/**
 * Gate for browser requests. `off` is a no-op so shipping this does not change
 * production behaviour. `monitor` logs one structured line (never the token)
 * and always lets the request through; `enforce` rejects without a valid token.
 */
export async function checkAppCheck(
  request: Request,
  env: AppCheckConfig,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const mode = appCheckMode(env.APP_CHECK_MODE);
  if (mode === "off") return;
  const projectNumber = env.FIREBASE_PROJECT_NUMBER?.trim();
  if (!projectNumber) {
    if (mode === "enforce")
      throw new HttpError(500, "app_check_misconfigured");
    console.warn(JSON.stringify({ event: "app_check_misconfigured", mode }));
    return;
  }
  const token = request.headers.get("x-firebase-appcheck");
  if (!token) {
    if (mode === "enforce") throw new HttpError(401, "app_check_required");
    console.warn(JSON.stringify({ event: "app_check_missing", mode }));
    return;
  }
  try {
    await verifyAppCheck(token, projectNumber, fetcher);
  } catch {
    if (mode === "enforce") throw new HttpError(401, "app_check_required");
    console.warn(JSON.stringify({ event: "app_check_invalid", mode }));
  }
}

import { createLocalJWKSet, jwtVerify, type JSONWebKeySet } from "jose";

export const FIREBASE_JWKS_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

export interface FirebaseIdentity {
  uid: string;
  email: string;
  emailVerified: boolean;
  /** When the user last signed in, in seconds; refreshing a token keeps it. */
  authTime: number;
}

export class AuthenticationError extends Error {
  constructor() {
    super("unauthorized");
  }
}

/** Fallback key-cache lifetime when Google sends no usable max-age (5 minutes). */
const MIN_JWKS_CACHE_MS = 300_000;

/** Cache Google public keys for their advertised lifetime, shared by one isolate. */
export function createFirebaseVerifier(fetcher: typeof fetch) {
  let cached:
    { keys: ReturnType<typeof createLocalJWKSet>; expires: number } | undefined;
  let pending: Promise<ReturnType<typeof createLocalJWKSet>> | undefined;

  async function keys() {
    if (cached && cached.expires > Date.now()) return cached.keys;
    if (!pending) {
      pending = (async () => {
        const response = await fetcher(FIREBASE_JWKS_URL, {
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) throw new AuthenticationError();
        const data = (await response.json()) as JSONWebKeySet;
        const resolver = createLocalJWKSet(data);
        const match = /(?:^|,)\s*max-age=(\d+)(?:\s|,|$)/i.exec(
          response.headers.get("cache-control") ?? "",
        );
        const advertised = match ? Number(match[1]) : Number.NaN;
        const age = Number(response.headers.get("age") ?? 0);
        const lifetime =
          Number.isFinite(advertised) && advertised > 0
            ? Math.max(0, advertised - (Number.isFinite(age) ? age : 0)) * 1000
            : MIN_JWKS_CACHE_MS;
        cached = { keys: resolver, expires: Date.now() + lifetime };
        return resolver;
      })().finally(() => {
        pending = undefined;
      });
    }
    return pending;
  }

  return async function verify(
    request: Request,
    projectId: string,
  ): Promise<FirebaseIdentity> {
    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) throw new AuthenticationError();
    const token = authorization.slice(7);
    // Firebase tokens are small; reject oversized input before any crypto or JWKS fetch.
    if (!token || token.length > 16_384 || !projectId)
      throw new AuthenticationError();
    try {
      const { payload } = await jwtVerify(token, await keys(), {
        algorithms: ["RS256"],
        issuer: `https://securetoken.google.com/${projectId}`,
        audience: projectId,
        requiredClaims: ["sub", "iat", "exp", "auth_time"],
      });
      const now = Math.floor(Date.now() / 1000);
      if (
        payload.aud !== projectId ||
        !payload.sub ||
        payload.sub.length > 128 ||
        typeof payload.iat !== "number" ||
        payload.iat > now ||
        typeof payload.auth_time !== "number" ||
        payload.auth_time > now ||
        typeof payload.email !== "string" ||
        !payload.email.trim()
      )
        throw new AuthenticationError();
      return {
        uid: payload.sub,
        email: payload.email,
        emailVerified: payload.email_verified === true,
        authTime: payload.auth_time,
      };
    } catch {
      throw new AuthenticationError();
    }
  };
}

export const verifyFirebaseToken = createFirebaseVerifier(fetch);

/** Admin identity never comes from D1, client state or a writable profile field. */
export function isAdministrator(
  identity: FirebaseIdentity,
  adminEmails: string,
): boolean {
  return (
    identity.emailVerified &&
    adminEmails
      .split(/[,\n]/)
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
      .includes(identity.email.toLowerCase())
  );
}

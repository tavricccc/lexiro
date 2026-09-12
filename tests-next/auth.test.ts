import { beforeAll, afterEach, describe, expect, it, vi } from "vitest";
import { exportJWK, generateKeyPair, SignJWT, type JWTPayload } from "jose";
import { AuthenticationError, createFirebaseVerifier, FIREBASE_JWKS_URL, isAdministrator } from "../src/auth";

let pair: Awaited<ReturnType<typeof generateKeyPair>>, jwks: string;
const project = "lexiro-test";
beforeAll(async () => {
  pair = await generateKeyPair("RS256");
  jwks = JSON.stringify({ keys: [{ ...await exportJWK(pair.publicKey), kid: "google-test-key", use: "sig", alg: "RS256" }] });
});
afterEach(() => vi.useRealTimers());
async function request(overrides: JWTPayload = {}, key = pair.privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const token = await new SignJWT({
    sub: "uid-123", iss: `https://securetoken.google.com/${project}`, aud: project,
    iat: now, exp: now + 3600, auth_time: now - 5,
    email: "owner@example.com", email_verified: true, ...overrides,
  }).setProtectedHeader({ alg: "RS256", kid: "google-test-key" }).sign(key);
  return new Request("https://worker.test/me", { headers: { authorization: `Bearer ${token}` } });
}
function setup(cacheControl = "public, max-age=3600, must-revalidate", age = "0") {
  const fetcher = vi.fn<typeof fetch>(async () => new Response(jwks, {
    headers: { "cache-control": cacheControl, age },
  }));
  return { verify: createFirebaseVerifier(fetcher), fetcher };
}

describe("Firebase identity boundary", () => {
  it("verifies the Google signature and the project before returning identity", async () => {
    const { verify, fetcher } = setup();
    expect(await verify(await request(), project)).toEqual({ uid: "uid-123", email: "owner@example.com", emailVerified: true });
    expect(fetcher).toHaveBeenCalledWith(FIREBASE_JWKS_URL, expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });
  it.each([
    { iss: "https://attacker.example" }, { aud: "other-project" }, { aud: [project] }, { exp: 1 },
    { exp: undefined }, { auth_time: undefined },
    { sub: "" }, { sub: "x".repeat(129) }, { email: "" },
    { iat: 9_999_999_999 }, { auth_time: 9_999_999_999 }, { auth_time: "yesterday" },
  ])("rejects invalid Firebase claims %j", async (claims) => {
    const { verify } = setup();
    await expect(verify(await request(claims), project)).rejects.toThrow(AuthenticationError);
  });
  it("rejects a token signed by an unrelated key", async () => {
    const other = await generateKeyPair("RS256");
    await expect(setup().verify(await request({}, other.privateKey), project)).rejects.toThrow("unauthorized");
  });
  it("rejects a symmetric algorithm even when all claims appear plausible", async () => {
    const token = await new SignJWT({ sub: "uid-123" }).setProtectedHeader({ alg: "HS256" }).sign(new TextEncoder().encode("not-a-google-key"));
    await expect(setup().verify(new Request("https://worker.test/me", { headers: { authorization: `Bearer ${token}` } }), project)).rejects.toThrow("unauthorized");
  });
  it("rejects missing credentials without fetching public keys", async () => {
    const { verify, fetcher } = setup();
    await expect(verify(new Request("https://worker.test/me"), project)).rejects.toThrow("unauthorized");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("shares in-flight public key loading across concurrent requests", async () => {
    const { verify, fetcher } = setup();
    const incoming = await request();
    await Promise.all([verify(incoming, project), verify(incoming, project), verify(incoming, project)]);
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it("refreshes the cache at max-age minus the upstream Age header", async () => {
    const { verify, fetcher } = setup("public, max-age=60", "30");
    const now = Date.now();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);
    const incoming = await request();
    await verify(incoming, project);
    vi.setSystemTime(now + 29_000);
    await verify(incoming, project);
    expect(fetcher).toHaveBeenCalledOnce();
    vi.setSystemTime(now + 30_000);
    await verify(incoming, project);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("never uses stale keys after a failed refresh and returns no Google error body", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(jwks, { headers: { "cache-control": "max-age=1" } }))
      .mockResolvedValueOnce(new Response("private diagnostics", { status: 503 }));
    const verify = createFirebaseVerifier(fetcher);
    const now = Date.now();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);
    const incoming = await request();
    await verify(incoming, project);
    vi.setSystemTime(now + 1_000);
    await expect(verify(incoming, project)).rejects.toThrow(/^unauthorized$/);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("grants admin only to a verified email in the Worker secret", () => {
    const identity = { uid: "uid", email: "Owner@Example.com", emailVerified: true };
    expect(isAdministrator(identity, "other@example.com, owner@example.com\n")).toBe(true);
    expect(isAdministrator({ ...identity, emailVerified: false }, "owner@example.com")).toBe(false);
    expect(isAdministrator(identity, "")).toBe(false);
    expect(isAdministrator(identity, "owner@example.com.attacker.test")).toBe(false);
  });
});

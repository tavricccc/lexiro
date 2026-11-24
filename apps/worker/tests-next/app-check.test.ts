import { beforeAll, afterEach, describe, expect, it, vi } from "vitest";
import { exportJWK, generateKeyPair, SignJWT, type JWTPayload } from "jose";
import type { ExecutionContext } from "@cloudflare/workers-types";
import {
  APP_CHECK_JWKS_URL,
  appCheckMode,
  checkAppCheck,
  verifyAppCheck,
} from "../src/app-check";
import { HttpError } from "../src/http";
import { createWorker } from "../src/index";
import type { AgentEnv } from "../src/agent/types";

// The real OAuth provider imports "cloudflare:workers", which the Node test
// runner cannot load. The CORS preflight path never constructs it, so a stub
// is enough to import the Agent Worker for its header behaviour.
vi.mock("@cloudflare/workers-oauth-provider", () => ({
  OAuthProvider: class {},
}));

const projectNumber = "123456789";
const issuer = `https://firebaseappcheck.googleapis.com/${projectNumber}`;
const audience = `projects/${projectNumber}`;

let pair: Awaited<ReturnType<typeof generateKeyPair>>, jwks: string;
beforeAll(async () => {
  pair = await generateKeyPair("RS256");
  jwks = JSON.stringify({
    keys: [
      {
        ...await exportJWK(pair.publicKey),
        kid: "app-check-test-key",
        use: "sig",
        alg: "RS256",
      },
    ],
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const fetcher = vi.fn<typeof fetch>(async () =>
  new Response(jwks, {
    headers: { "cache-control": "public, max-age=3600, must-revalidate", age: "0" },
  }),
);

async function token(overrides: JWTPayload = {}, key = pair.privateKey) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    sub: "app-instance-1",
    iss: issuer,
    aud: [audience],
    iat: now,
    exp: now + 3600,
    ...overrides,
  })
    .setProtectedHeader({ alg: "RS256", kid: "app-check-test-key" })
    .sign(key);
}
function request(appCheckToken?: string) {
  return new Request("https://worker.test/me", {
    headers: appCheckToken ? { "x-firebase-appcheck": appCheckToken } : {},
  });
}
const enforce: { APP_CHECK_MODE: string; FIREBASE_PROJECT_NUMBER: string } = {
  APP_CHECK_MODE: "enforce",
  FIREBASE_PROJECT_NUMBER: projectNumber,
};

describe("App Check boundary", () => {
  it("returns immediately in off mode without fetching keys", async () => {
    const spy = vi.fn<typeof fetch>();
    await expect(
      checkAppCheck(request("anything"), { APP_CHECK_MODE: "off" }, spy),
    ).resolves.toBeUndefined();
    expect(spy).not.toHaveBeenCalled();
  });
  it("treats an unrecognised mode as off", async () => {
    const spy = vi.fn<typeof fetch>();
    expect(appCheckMode("bogus")).toBe("off");
    expect(appCheckMode(undefined)).toBe("off");
    await expect(
      checkAppCheck(request(), { APP_CHECK_MODE: "logging" }, spy),
    ).resolves.toBeUndefined();
    expect(spy).not.toHaveBeenCalled();
  });
  it("monitors a missing token, warns once and lets the request through", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(
      checkAppCheck(request(), { APP_CHECK_MODE: "monitor", FIREBASE_PROJECT_NUMBER: projectNumber }, fetcher),
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain("app_check_missing");
  });
  it("monitors an invalid token without logging the token itself", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const other = await generateKeyPair("RS256");
    const bad = await token({}, other.privateKey);
    await expect(
      checkAppCheck(request(bad), { APP_CHECK_MODE: "monitor", FIREBASE_PROJECT_NUMBER: projectNumber }, fetcher),
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    const line = String(warn.mock.calls[0]?.[0]);
    expect(line).toContain("app_check_invalid");
    expect(line).not.toContain(bad);
  });
  it("enforces a token under enforce mode", async () => {
    await expect(
      checkAppCheck(request(await token()), enforce, fetcher),
    ).resolves.toBeUndefined();
  });
  it("rejects a missing header with 401 in enforce mode", async () => {
    await expect(checkAppCheck(request(), enforce, fetcher)).rejects.toMatchObject({
      status: 401,
      code: "app_check_required",
    });
  });
  it("rejects a token signed by an unrelated key in enforce mode", async () => {
    const other = await generateKeyPair("RS256");
    await expect(
      checkAppCheck(request(await token({}, other.privateKey)), enforce, fetcher),
    ).rejects.toMatchObject({ status: 401, code: "app_check_required" });
  });
  it("rejects a wrong issuer in enforce mode", async () => {
    await expect(
      checkAppCheck(
        request(await token({ iss: "https://firebaseappcheck.googleapis.com/999" })),
        enforce,
        fetcher,
      ),
    ).rejects.toMatchObject({ status: 401, code: "app_check_required" });
  });
  it("rejects a wrong audience in enforce mode", async () => {
    await expect(
      checkAppCheck(
        request(await token({ aud: ["projects/999"] })),
        enforce,
        fetcher,
      ),
    ).rejects.toMatchObject({ status: 401, code: "app_check_required" });
  });
  it("rejects an expired token in enforce mode", async () => {
    const now = Math.floor(Date.now() / 1000);
    await expect(
      checkAppCheck(
        request(await token({ iat: now - 7200, exp: now - 3600 })),
        enforce,
        fetcher,
      ),
    ).rejects.toMatchObject({ status: 401, code: "app_check_required" });
  });
  it("rejects an empty subject in enforce mode", async () => {
    await expect(
      checkAppCheck(request(await token({ sub: "  " })), enforce, fetcher),
    ).rejects.toMatchObject({ status: 401, code: "app_check_required" });
  });
  it("fails closed with 500 when enforce has no project number", async () => {
    const error = await checkAppCheck(request(await token()), { APP_CHECK_MODE: "enforce" }, fetcher).then(
      () => null,
      (reason: unknown) => reason,
    );
    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({ status: 500, code: "app_check_misconfigured" });
  });
  it("passes and warns when monitor has no project number", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(
      checkAppCheck(request(), { APP_CHECK_MODE: "monitor" }, fetcher),
    ).resolves.toBeUndefined();
    expect(String(warn.mock.calls[0]?.[0])).toContain("app_check_misconfigured");
  });
  it("verifies a correct token against the App Check JWKS URL", async () => {
    const spy = vi.fn<typeof fetch>(async () =>
      new Response(jwks, { headers: { "cache-control": "max-age=3600" } }),
    );
    await expect(
      verifyAppCheck(await token(), projectNumber, spy),
    ).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalledWith(
      APP_CHECK_JWKS_URL,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
});

describe("App Check CORS preflight", () => {
  it("allows X-Firebase-AppCheck on the Agent Worker", async () => {
    const worker = createWorker();
    const response = await worker.fetch(
      new Request("https://agent.test/mcp", {
        method: "OPTIONS",
        headers: { origin: "https://app.test" },
      }),
      { APP_ORIGIN: "https://app.test" } as AgentEnv,
      {} as ExecutionContext,
    );
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-headers")).toContain(
      "X-Firebase-AppCheck",
    );
    expect(response.headers.get("access-control-max-age")).toBe("86400");
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const appCheckMock = vi.hoisted(() => {
  class ReCaptchaEnterpriseProvider {
    siteKey: string;
    constructor(siteKey: string) {
      this.siteKey = siteKey;
    }
  }
  return {
    initializeAppCheck: vi.fn((_app: unknown, _options: unknown) => ({
      name: "appCheck",
    })),
    getToken: vi.fn(async () => ({ token: "token-123" })),
    ReCaptchaEnterpriseProvider,
  };
});
vi.mock("firebase/app-check", () => appCheckMock);
vi.mock("@/src/lib/firebase", () => ({
  getFirebaseApp: () => ({ name: "[DEFAULT]" }),
}));

beforeEach(() => {
  vi.resetModules();
  appCheckMock.initializeAppCheck.mockClear();
  appCheckMock.getToken.mockReset().mockResolvedValue({ token: "token-123" });
});
afterEach(() => {
  vi.unstubAllEnvs();
  delete (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean })
    .FIREBASE_APPCHECK_DEBUG_TOKEN;
});

describe("App Check client headers", () => {
  it("returns no headers when no site key is configured", async () => {
    const { appCheckHeaders } = await import("@/src/lib/app-check");
    await expect(appCheckHeaders()).resolves.toEqual({});
    expect(appCheckMock.initializeAppCheck).not.toHaveBeenCalled();
    expect(appCheckMock.getToken).not.toHaveBeenCalled();
  });

  it("returns the App Check token header when a site key is configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY", "site-key");
    const { appCheckHeaders } = await import("@/src/lib/app-check");
    await expect(appCheckHeaders()).resolves.toEqual({
      "X-Firebase-AppCheck": "token-123",
    });
    expect(appCheckMock.initializeAppCheck).toHaveBeenCalledTimes(1);
    const options = appCheckMock.initializeAppCheck.mock
      .calls[0][1] as unknown as {
      provider: unknown;
      isTokenAutoRefreshEnabled: boolean;
    };
    expect(options.provider).toBeInstanceOf(
      appCheckMock.ReCaptchaEnterpriseProvider,
    );
    expect(options.isTokenAutoRefreshEnabled).toBe(true);
    expect(appCheckMock.getToken).toHaveBeenCalledWith(
      expect.anything(),
      false,
    );
  });

  it("swallows token failures and returns no headers", async () => {
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY", "site-key");
    appCheckMock.getToken.mockRejectedValue(new Error("recaptcha failed"));
    const { appCheckHeaders } = await import("@/src/lib/app-check");
    await expect(appCheckHeaders()).resolves.toEqual({});
  });

  it("initializes App Check only once across calls", async () => {
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY", "site-key");
    const { appCheckHeaders } = await import("@/src/lib/app-check");
    await appCheckHeaders();
    await appCheckHeaders();
    expect(appCheckMock.initializeAppCheck).toHaveBeenCalledTimes(1);
  });
});

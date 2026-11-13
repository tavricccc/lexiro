import { appCheckSiteKey } from "./config";

let pending: Promise<unknown> | null = null;

/** App Check headers when a site key is configured; never blocks a request. */
export async function appCheckHeaders(): Promise<Record<string, string>> {
  if (!appCheckSiteKey) return {};
  try {
    const { getApp } = await import("firebase/app");
    const module = await import("firebase/app-check");
    pending ??= Promise.resolve().then(() => {
      if (!import.meta.env.PROD) (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
      return module.initializeAppCheck(getApp(), { provider: new module.ReCaptchaEnterpriseProvider(appCheckSiteKey), isTokenAutoRefreshEnabled: true });
    });
    const { token } = await module.getToken((await pending) as Parameters<typeof module.getToken>[0], false);
    return { "X-Firebase-AppCheck": token };
  } catch {
    return {};
  }
}

import type { AppCheck } from "firebase/app-check";
import { getFirebaseApp } from "./firebase";
import { firebaseEnvironment } from "./firebase-config";

// App Check is optional: it only loads `firebase/app-check` (dynamically) when
// a site key is configured in a browser. Everything else returns no headers so
// the existing request flow is untouched.
let appCheckPromise: Promise<AppCheck | null> | null = null;

async function initializeAppCheck(): Promise<AppCheck | null> {
  const siteKey = firebaseEnvironment.appCheckSiteKey;
  if (!siteKey || typeof window === "undefined") return null;
  const app = getFirebaseApp();
  if (!app) return null;
  const { initializeAppCheck, ReCaptchaEnterpriseProvider } =
    await import("firebase/app-check");
  if (process.env.NODE_ENV !== "production")
    (
      self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean }
    ).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  return initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(siteKey),
    isTokenAutoRefreshEnabled: true,
  });
}

function getAppCheck(): Promise<AppCheck | null> {
  appCheckPromise ??= initializeAppCheck().catch(() => null);
  return appCheckPromise;
}

export async function appCheckHeaders(): Promise<Record<string, string>> {
  try {
    const appCheck = await getAppCheck();
    if (!appCheck) return {};
    const { getToken } = await import("firebase/app-check");
    // A stuck reCAPTCHA must not stall the request it is meant to accompany.
    const { token } = await Promise.race([
      getToken(appCheck, false),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("app-check-timeout")), 5000),
      ),
    ]);
    return token ? { "X-Firebase-AppCheck": token } : {};
  } catch {
    // App Check must never block the original request; the Worker decides
    // whether enforcement rejects it.
    return {};
  }
}

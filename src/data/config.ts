const env = import.meta.env;

export const firebaseConfig = {
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY as string | undefined,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: env.NEXT_PUBLIC_FIREBASE_APP_ID as string | undefined,
};
export const emulator = env.DEV && env.NEXT_PUBLIC_FIREBASE_EMULATOR_ENABLED === "true"
  ? `http://${(env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST as string | undefined)?.trim() || "127.0.0.1"}:9099`
  : null;
export const appCheckSiteKey = (env.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY as string | undefined)?.trim() || "";

/** The Worker every request goes to, without a trailing slash. */
export const workerUrl = ((env.NEXT_PUBLIC_AGENT_WORKER_URL as string | undefined) ?? "").trim().replace(/\/$/, "");

export const isConfigured = () => Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId && workerUrl);

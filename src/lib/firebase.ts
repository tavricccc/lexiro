import type { FirebaseApp } from "firebase/app";
import type { Auth } from "firebase/auth";
import { getApp, getApps, initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  connectAuthEmulator,
  getAuth,
  setPersistence,
} from "firebase/auth";
import {
  firebaseEnvironment as config,
  isFirebaseConfigured,
} from "./firebase-config";
export { isFirebaseConfigured } from "./firebase-config";
let app: FirebaseApp | null = null,
  auth: Auth | null = null,
  emulatorConnected = false;
export function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured()) return null;
  app ??= getApps().some((existing) => existing.name === "[DEFAULT]")
    ? getApp()
    : initializeApp(config);
  return app;
}
export function getFirebaseAuth(): Auth | null {
  const firebase = getFirebaseApp();
  if (!firebase) return null;
  auth ??= getAuth(firebase);
  if (
    process.env.NODE_ENV !== "production" &&
    config.emulatorEnabled === "true" &&
    !emulatorConnected
  ) {
    connectAuthEmulator(
      auth,
      `http://${config.emulatorHost?.trim() || "127.0.0.1"}:9099`,
      { disableWarnings: true },
    );
    emulatorConnected = true;
  }
  return auth;
}
let sameOriginAuth: Auth | null = null;
/**
 * Auth whose sign-in handler is served from this site (next.config proxies
 * /__/auth). Browsers that partition third-party storage, such as the iOS
 * sign-in sheet, lose a redirect result kept on the firebaseapp.com domain.
 */
export function getSameOriginAuth(): Auth | null {
  if (!isFirebaseConfigured()) return null;
  if (window.location.protocol !== "https:") return getFirebaseAuth();
  sameOriginAuth ??= getAuth(
    getApps().find((existing) => existing.name === "same-origin") ??
      initializeApp(
        { ...config, authDomain: window.location.host },
        "same-origin",
      ),
  );
  return sameOriginAuth;
}
export async function configureFirebaseAuth(): Promise<Auth | null> {
  const firebase = getFirebaseAuth();
  if (!firebase) return null;
  await setPersistence(firebase, browserLocalPersistence);
  return firebase;
}

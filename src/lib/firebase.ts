import type { FirebaseApp } from "firebase/app";
import type { Auth } from "firebase/auth";
import { getApp, getApps, initializeApp } from "firebase/app";
import { browserLocalPersistence, connectAuthEmulator, getAuth, setPersistence } from "firebase/auth";
import { firebaseEnvironment as config, isFirebaseConfigured } from "./firebase-config";
export { isFirebaseConfigured } from "./firebase-config";
let app: FirebaseApp | null = null, auth: Auth | null = null, emulatorConnected = false;
export function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured()) return null;
  app ??= getApps().length ? getApp() : initializeApp(config);
  return app;
}
export function getFirebaseAuth(): Auth | null {
  const firebase = getFirebaseApp();
  if (!firebase) return null;
  auth ??= getAuth(firebase);
  if (process.env.NODE_ENV !== "production" && config.emulatorEnabled === "true" && !emulatorConnected) {
    connectAuthEmulator(auth, `http://${config.emulatorHost?.trim() || "127.0.0.1"}:9099`, { disableWarnings: true });
    emulatorConnected = true;
  }
  return auth;
}
export async function configureFirebaseAuth(): Promise<Auth | null> {
  const firebase = getFirebaseAuth();
  if (!firebase) return null;
  await setPersistence(firebase, browserLocalPersistence);
  return firebase;
}

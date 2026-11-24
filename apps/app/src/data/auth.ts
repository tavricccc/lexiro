import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  deleteUser,
  getAuth,
  getReactNativePersistence,
  initializeAuth,
  onAuthStateChanged,
  type Auth,
  type User,
} from "firebase/auth";
import { useSyncExternalStore } from "react";

import { firebaseConfig, isFirebaseConfigured } from "@/platform/firebase-config";
import { SignInCancelled, signInWithGoogle } from "@/platform/sign-in";

export { SignInCancelled };

export interface Account {
  uid: string;
  name: string;
  email: string;
  photo: string | null;
}

type AuthState = { ready: boolean; account: Account | null };

let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let state: AuthState = { ready: false, account: null };
const listeners = new Set<() => void>();

const toAccount = (user: User): Account => ({
  uid: user.uid,
  name: user.displayName || user.email?.split("@")[0] || "Lexiro",
  email: user.email ?? "",
  photo: user.photoURL,
});

function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured()) return null;
  appInstance ??= getApps().length ? getApp() : initializeApp(firebaseConfig);
  return appInstance;
}

export function firebaseAuth(): Auth | null {
  if (authInstance) return authInstance;
  const app = getFirebaseApp();
  if (!app) return null;
  try {
    authInstance = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    authInstance = getAuth(app);
  }
  onAuthStateChanged(authInstance, (user) => {
    state = { ready: true, account: user ? toAccount(user) : null };
    for (const listener of listeners) listener();
  });
  return authInstance;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!firebaseAuth()) {
    state = { ready: true, account: null };
    queueMicrotask(listener);
  }
  return () => listeners.delete(listener);
}

export function useAuth(): AuthState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

export const currentAccount = () => state.account;

export async function signIn(): Promise<void> {
  const target = firebaseAuth();
  if (!target) throw new Error("Lexiro 尚未設定登入服務。");
  await signInWithGoogle(target);
}

export async function signOut(): Promise<void> {
  const target = firebaseAuth();
  if (target) await target.signOut();
}

export async function idToken(fresh = false): Promise<string | null> {
  const target = firebaseAuth();
  if (!target) return null;
  await target.authStateReady();
  return (await target.currentUser?.getIdToken(fresh)) ?? null;
}

/**
 * Re-authenticates through the PKCE Google flow (so Firebase & Worker accept
 * the deletion), verifies the same account signed back in, erases Worker data,
 * and deletes the Firebase user.
 */
export async function deleteAccount(erase: () => Promise<void>): Promise<void> {
  const target = firebaseAuth();
  const previous = target?.currentUser;
  if (!target || !previous) return;
  const uid = previous.uid;
  await signInWithGoogle(target);
  const current = target.currentUser;
  if (!current || current.uid !== uid) {
    throw new Error("請用要刪除的那個帳號重新登入。");
  }
  await current.getIdToken(true);
  await erase();
  await deleteUser(current);
}

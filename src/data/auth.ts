import { useSyncExternalStore } from "react";
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  connectAuthEmulator,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  type Auth,
  type User,
} from "firebase/auth";
import { emulator, firebaseConfig, isConfigured } from "./config";

export interface Account {
  uid: string;
  name: string;
  email: string;
  photo: string | null;
}
type State = { ready: boolean; account: Account | null };

let auth: Auth | null = null;
let state: State = { ready: false, account: null };
const listeners = new Set<() => void>();

function app(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

/**
 * Auth whose sign-in handler is served from this site (vercel.json proxies
 * /__/auth). Browsers that partition third-party storage, such as the iOS
 * sign-in sheet, lose a redirect result kept on the firebaseapp.com domain.
 */
export function sameOriginAuth(): Auth | null {
  if (!isConfigured()) return null;
  if (location.protocol !== "https:") return firebaseAuth();
  const named = getApps().find((existing) => existing.name === "same-origin")
    ?? initializeApp({ ...firebaseConfig, authDomain: location.host }, "same-origin");
  return getAuth(named);
}

export function firebaseAuth(): Auth | null {
  if (!isConfigured()) return null;
  if (!auth) {
    auth = getAuth(app());
    if (emulator) connectAuthEmulator(auth, emulator, { disableWarnings: true });
    onAuthStateChanged(auth, (user) => {
      state = { ready: true, account: user ? toAccount(user) : null };
      for (const listener of listeners) listener();
    });
  }
  return auth;
}

const toAccount = (user: User): Account => ({
  uid: user.uid,
  name: user.displayName || user.email?.split("@")[0] || "Lexiro",
  email: user.email ?? "",
  photo: user.photoURL,
});

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!firebaseAuth()) {
    state = { ready: true, account: null };
    queueMicrotask(listener);
  }
  return () => listeners.delete(listener);
}

/** The signed-in account, and whether Firebase has finished restoring it. */
export function useAuth(): State {
  return useSyncExternalStore(subscribe, () => state, () => state);
}
export const currentAccount = () => state.account;

export async function signIn(): Promise<void> {
  const target = firebaseAuth();
  if (!target) throw new Error("Lexiro 尚未設定登入服務。");
  const { signInWithPopup, signInWithRedirect } = await import("firebase/auth");
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(target, provider);
  } catch (reason) {
    // A blocked popup (in-app browsers) cannot sign in at all: use a full-page redirect.
    const code = (reason as { code?: string } | null)?.code;
    if (code !== "auth/popup-blocked" && code !== "auth/operation-not-supported-in-this-environment") throw reason;
    await signInWithRedirect(target, provider);
  }
}

export async function signOut(): Promise<void> {
  const current = firebaseAuth();
  if (current) await current.signOut();
}

/** An ID token for the Worker; `fresh` forces a new one. */
export async function idToken(fresh = false): Promise<string | null> {
  const current = firebaseAuth();
  await current?.authStateReady();
  return (await current?.currentUser?.getIdToken(fresh)) ?? null;
}

/**
 * Signs in again (the Worker and Firebase both ask for a recent sign-in),
 * then runs `erase` and deletes the Firebase user. Refuses another account.
 */
export async function deleteAccount(erase: () => Promise<void>): Promise<void> {
  const current = firebaseAuth();
  const user = current?.currentUser;
  if (!current || !user) return;
  const { reauthenticateWithPopup, deleteUser } = await import("firebase/auth");
  await reauthenticateWithPopup(user, new GoogleAuthProvider());
  if (current.currentUser?.uid !== user.uid) throw new Error("請用要刪除的那個帳號重新登入。");
  await user.getIdToken(true);
  await erase();
  await deleteUser(user);
}

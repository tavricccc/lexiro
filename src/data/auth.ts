import { useSyncExternalStore } from "react";
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  connectAuthEmulator,
  getAuth,
  GoogleAuthProvider,
  indexedDBLocalPersistence,
  initializeAuth,
  onAuthStateChanged,
  type Auth,
  type AuthProvider,
  type User,
  type UserCredential,
} from "firebase/auth";
import { emulator, firebaseConfig, isConfigured } from "./config";
import { mockAccount, mockEnabled } from "./mock";

export interface Account {
  uid: string;
  name: string;
  email: string;
  photo: string | null;
}
type State = { ready: boolean; account: Account | null };

let auth: Auth | null = null;
let state: State = mockEnabled ? { ready: true, account: mockAccount } : { ready: false, account: null };
const listeners = new Set<() => void>();

/**
 * Sign-in runs through this site's own /__/auth (vercel.json proxies it), so
 * the redirect result lives on our origin. With the firebaseapp.com domain,
 * Safari and the iOS home-screen app drop the result as third-party storage,
 * and every redirect sign-in came back signed out: the sign-in loop.
 */
const ownAuthDomain = () => (location.protocol === "https:" && !emulator ? location.host : firebaseConfig.authDomain);

function app(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp({ ...firebaseConfig, authDomain: ownAuthDomain() });
}

/**
 * Auth that falls back to localStorage when IndexedDB is unusable (Safari
 * closes it for pages that were hidden, private mode, some in-app browsers).
 */
function authFor(target: FirebaseApp): Auth {
  try {
    return initializeAuth(target, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence],
      popupRedirectResolver: browserPopupRedirectResolver,
    });
  } catch {
    return getAuth(target); // already initialized
  }
}

export const SIGN_IN_FAILED = "登入沒有完成，請重新整理頁面後再試一次。";

const REDIRECT_CODES = new Set([
  "auth/popup-blocked",
  "auth/operation-not-supported-in-this-environment",
  "auth/web-storage-unsupported",
]);

/** Safari's "database connection is closing" once a hidden page comes back. */
export function isClosedStorage(reason: unknown): boolean {
  const error = reason as { name?: string; message?: string } | null;
  return error?.name === "InvalidStateError" || /connection is closing|database.*clos/i.test(error?.message ?? "");
}

/**
 * Google sign-in by popup; a storage hiccup is retried once, and a browser
 * that cannot do popups (or keeps failing storage) gets a full-page redirect.
 * Resolves `null` when the page is leaving for the redirect.
 */
export async function popupOrRedirect(
  target: Auth,
  provider: AuthProvider,
  beforeRedirect?: () => void,
): Promise<UserCredential | null> {
  const { signInWithPopup, signInWithRedirect } = await import("firebase/auth");
  let reason: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await signInWithPopup(target, provider);
    } catch (error) {
      reason = error;
      if (!isClosedStorage(error)) break;
    }
  }
  const code = (reason as { code?: string } | null)?.code ?? "";
  if (!REDIRECT_CODES.has(code) && !isClosedStorage(reason)) throw reason;
  beforeRedirect?.();
  await signInWithRedirect(target, provider);
  return null;
}

/**
 * Auth whose sign-in handler is served from this site (vercel.json proxies
 * /__/auth). Browsers that partition third-party storage, such as the iOS
 * sign-in sheet, lose a redirect result kept on the firebaseapp.com domain.
 */
export function sameOriginAuth(): Auth | null {
  return firebaseAuth();
}

export function firebaseAuth(): Auth | null {
  if (!isConfigured()) return null;
  if (!auth) {
    auth = authFor(app());
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
  if (mockEnabled) return () => listeners.delete(listener);
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
  try {
    await popupOrRedirect(target, new GoogleAuthProvider());
  } catch (reason) {
    if (isClosedStorage(reason)) throw new Error(SIGN_IN_FAILED);
    throw reason;
  }
}

export async function signOut(): Promise<void> {
  const current = firebaseAuth();
  if (current) await current.signOut();
}

/** An ID token for the Worker; `fresh` forces a new one. */
export async function idToken(fresh = false): Promise<string | null> {
  if (mockEnabled) return "mock";
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
  try {
    await reauthenticateWithPopup(user, new GoogleAuthProvider());
  } catch (reason) {
    if (!isClosedStorage(reason)) throw reason;
    await reauthenticateWithPopup(user, new GoogleAuthProvider());
  }
  if (current.currentUser?.uid !== user.uid) throw new Error("請用要刪除的那個帳號重新登入。");
  await user.getIdToken(true);
  await erase();
  await deleteUser(user);
}

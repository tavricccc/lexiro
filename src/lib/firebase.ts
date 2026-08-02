import type { FirebaseApp } from 'firebase/app'
import type { AppCheck } from 'firebase/app-check'
import type { Auth } from 'firebase/auth'
import type { Firestore } from 'firebase/firestore'
import { getApp, getApps, initializeApp } from 'firebase/app'
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check'
import { browserLocalPersistence, getAuth, setPersistence } from 'firebase/auth'
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
  appCheckSiteKey: import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY as string | undefined,
  appCheckEnabled: import.meta.env.VITE_FIREBASE_APPCHECK_ENABLED as string | undefined,
  appCheckDebugToken: import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN as string | undefined,
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined,
}

export function isFirebaseConfigured(): boolean {
  return Boolean(config.apiKey && config.authDomain && config.projectId && config.appId && config.googleClientId)
}

let firebaseApp: FirebaseApp | null = null
let firebaseAuth: Auth | null = null
let firestore: Firestore | null = null
let appCheck: AppCheck | null = null

export function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured())
    return null
  firebaseApp ??= getApps().length ? getApp() : initializeApp(config)
  const hasDebugToken = Boolean(config.appCheckDebugToken && !import.meta.env.PROD)
  // App Check is always enabled in production when the production site key is
  // present. The explicit flag is only a local-development switch; it must
  // never become a production bypass when Firestore enforcement is enabled.
  const shouldUseAppCheck = Boolean(config.appCheckSiteKey && (import.meta.env.PROD || config.appCheckEnabled === 'true' || hasDebugToken))
  if (shouldUseAppCheck && !appCheck) {
    try {
      if (hasDebugToken) {
        const debugGlobal = globalThis as typeof globalThis & { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string }
        debugGlobal.FIREBASE_APPCHECK_DEBUG_TOKEN = config.appCheckDebugToken === 'true' ? true : config.appCheckDebugToken
      }
      appCheck = initializeAppCheck(firebaseApp, {
        provider: new ReCaptchaEnterpriseProvider(config.appCheckSiteKey!),
        isTokenAutoRefreshEnabled: true,
      })
    }
    catch (error) {
      console.error('[Firebase App Check] initialization failed', error)
      appCheck = null
    }
  }
  return firebaseApp
}

export function getFirebaseAuth(): Auth | null {
  const app = getFirebaseApp()
  if (!app)
    return null
  firebaseAuth ??= getAuth(app)
  return firebaseAuth
}

export function getFirebaseFirestore(): Firestore | null {
  const app = getFirebaseApp()
  if (!app)
    return null
  if (!firestore) {
    firestore = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    })
  }
  return firestore
}

export async function configureFirebaseAuth(): Promise<Auth | null> {
  const auth = getFirebaseAuth()
  if (!auth)
    return null
  await setPersistence(auth, browserLocalPersistence)
  return auth
}

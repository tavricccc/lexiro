import type { FirebaseApp } from 'firebase/app'
import type { AppCheck } from 'firebase/app-check'
import type { Auth } from 'firebase/auth'
import type { Firestore } from 'firebase/firestore'
import { getApp, getApps, initializeApp } from 'firebase/app'
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check'
import { browserLocalPersistence, connectAuthEmulator, getAuth, setPersistence } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore, initializeFirestore, memoryLocalCache, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'
import { CloudSyncError } from './cloud-sync-errors'
import { shouldEnableAppCheck } from './firebase-config'

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
  emulatorEnabled: import.meta.env.VITE_FIREBASE_EMULATOR_ENABLED as string | undefined,
  emulatorHost: import.meta.env.VITE_FIREBASE_EMULATOR_HOST as string | undefined,
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined,
}

export function isFirebaseConfigured(): boolean {
  return Boolean(config.apiKey && config.authDomain && config.projectId && config.appId && config.googleClientId)
}

let firebaseApp: FirebaseApp | null = null
let firebaseAuth: Auth | null = null
let firestore: Firestore | null = null
let appCheck: AppCheck | null = null
let authEmulatorConnected = false
let firestoreEmulatorConnected = false

function useEmulators(): boolean {
  return !import.meta.env.PROD && config.emulatorEnabled === 'true'
}

function emulatorHost(): string {
  return config.emulatorHost?.trim() || '127.0.0.1'
}

export function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured())
    return null
  firebaseApp ??= getApps().length ? getApp() : initializeApp(config)
  const hasDebugToken = Boolean(config.appCheckDebugToken?.trim() && !import.meta.env.PROD)
  // A site key alone does not mean the Firebase Web App is registered with
  // App Check. Require an explicit switch so an incomplete console setup does
  // not break every Firestore request in production.
  const shouldUseAppCheck = shouldEnableAppCheck({
    production: import.meta.env.PROD,
    emulatorEnabled: useEmulators(),
    appCheckSiteKey: config.appCheckSiteKey,
    appCheckEnabled: config.appCheckEnabled,
    appCheckDebugToken: config.appCheckDebugToken,
  })
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
      throw new CloudSyncError('cloud/app-check-initialization', 'Firebase App Check 初始化失敗', { cause: error })
    }
  }
  return firebaseApp
}

export function getFirebaseAuth(): Auth | null {
  const app = getFirebaseApp()
  if (!app)
    return null
  firebaseAuth ??= getAuth(app)
  if (useEmulators() && !authEmulatorConnected) {
    try {
      connectAuthEmulator(firebaseAuth, `http://${emulatorHost()}:9099`, { disableWarnings: true })
    }
    catch (error) {
      console.warn('[Firebase Auth] emulator connection was not enabled', error)
    }
    authEmulatorConnected = true
  }
  return firebaseAuth
}

export function getFirebaseFirestore(): Firestore | null {
  const app = getFirebaseApp()
  if (!app)
    return null
  if (!firestore) {
    try {
      firestore = initializeFirestore(app, {
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      })
    }
    catch (error) {
      console.warn('[Firebase Firestore] persistent cache is unavailable; using memory cache', error)
      try {
        firestore = initializeFirestore(app, { localCache: memoryLocalCache() })
      }
      catch {
        firestore = getFirestore(app)
      }
    }
  }
  if (useEmulators() && !firestoreEmulatorConnected) {
    try {
      connectFirestoreEmulator(firestore, emulatorHost(), 8080)
    }
    catch (error) {
      console.warn('[Firebase Firestore] emulator connection was not enabled', error)
    }
    firestoreEmulatorConnected = true
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

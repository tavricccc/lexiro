export interface AppCheckActivationOptions {
  appCheckDebugToken?: string
  appCheckEnabled?: string
  appCheckSiteKey?: string
  emulatorEnabled: boolean
  production: boolean
}

export const firebaseEnvironment = {
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
  const config = firebaseEnvironment
  return Boolean(config.apiKey && config.authDomain && config.projectId && config.appId && config.googleClientId)
}

export function shouldEnableAppCheck(options: AppCheckActivationOptions): boolean {
  if (options.emulatorEnabled || !options.appCheckSiteKey?.trim())
    return false
  const debugEnabled = !options.production && Boolean(options.appCheckDebugToken?.trim())
  return options.appCheckEnabled === 'true' || debugEnabled
}

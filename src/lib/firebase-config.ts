export interface AppCheckActivationOptions {
  appCheckDebugToken?: string
  appCheckEnabled?: string
  appCheckSiteKey?: string
  emulatorEnabled: boolean
  production: boolean
}

export const firebaseEnvironment = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  appCheckSiteKey: process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY,
  appCheckEnabled: process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_ENABLED,
  appCheckDebugToken: process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN,
  emulatorEnabled: process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_ENABLED,
  emulatorHost: process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST,
  googleClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
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

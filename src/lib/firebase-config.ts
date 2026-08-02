export interface AppCheckActivationOptions {
  appCheckDebugToken?: string
  appCheckEnabled?: string
  appCheckSiteKey?: string
  emulatorEnabled: boolean
  production: boolean
}

export function shouldEnableAppCheck(options: AppCheckActivationOptions): boolean {
  if (options.emulatorEnabled || !options.appCheckSiteKey?.trim())
    return false
  const debugEnabled = !options.production && Boolean(options.appCheckDebugToken?.trim())
  return options.appCheckEnabled === 'true' || debugEnabled
}

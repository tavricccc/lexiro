import { describe, expect, it } from 'vitest'
import { shouldEnableAppCheck } from '@/lib/firebase-config'

describe('firebase App Check activation', () => {
  it('does not enable production App Check from a site key alone', () => {
    expect(shouldEnableAppCheck({
      production: true,
      emulatorEnabled: false,
      appCheckSiteKey: 'site-key',
    })).toBe(false)
  })

  it('requires both an explicit switch and a site key', () => {
    expect(shouldEnableAppCheck({
      production: true,
      emulatorEnabled: false,
      appCheckSiteKey: 'site-key',
      appCheckEnabled: 'true',
    })).toBe(true)
    expect(shouldEnableAppCheck({
      production: true,
      emulatorEnabled: false,
      appCheckEnabled: 'true',
    })).toBe(false)
  })

  it('allows registered debug tokens locally but never with emulators', () => {
    expect(shouldEnableAppCheck({
      production: false,
      emulatorEnabled: false,
      appCheckSiteKey: 'site-key',
      appCheckDebugToken: 'debug-token',
    })).toBe(true)
    expect(shouldEnableAppCheck({
      production: false,
      emulatorEnabled: true,
      appCheckSiteKey: 'site-key',
      appCheckEnabled: 'true',
    })).toBe(false)
  })
})

import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useUIStore } from '@/stores/ui'

describe('ui action dialogs', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('resolves each guest-data decision explicitly', async () => {
    const uiStore = useUIStore()
    const decision = uiStore.showGuestDataWarning()

    expect(uiStore.guestDataWarningOpen).toBe(true)
    uiStore.resolveGuestDataWarning('export')

    await expect(decision).resolves.toBe('export')
    expect(uiStore.guestDataWarningOpen).toBe(false)
  })
})

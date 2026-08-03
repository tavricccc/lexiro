import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { ref } from 'vue'
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

  it('saves and clears registered dirty forms before an update', async () => {
    const uiStore = useUIStore()
    const dirty = ref(true)
    let saveCount = 0
    const unregister = uiStore.registerDirtyForm({
      id: 'test-form',
      isDirty: () => dirty.value,
      save: () => {
        saveCount += 1
        dirty.value = false
        return true
      },
      discard: () => { dirty.value = false },
    })

    expect(uiStore.hasDirtyForms).toBe(true)
    await expect(uiStore.saveDirtyForms()).resolves.toBe(true)
    expect(saveCount).toBe(1)
    expect(uiStore.hasDirtyForms).toBe(false)
    unregister()
  })

  it('keeps the newest page loading state active when navigations overlap', () => {
    const uiStore = useUIStore()
    const firstToken = uiStore.beginPageLoading()
    const secondToken = uiStore.beginPageLoading()

    uiStore.endPageLoading(firstToken)
    expect(uiStore.pageLoading).toBe(true)

    uiStore.endPageLoading(secondToken)
    expect(uiStore.pageLoading).toBe(false)
  })

  it('keeps the app covered until startup work releases the fixed splash', () => {
    const uiStore = useUIStore()

    expect(uiStore.appStarting).toBe(true)
    uiStore.finishAppStartup()
    expect(uiStore.appStarting).toBe(false)
  })
})

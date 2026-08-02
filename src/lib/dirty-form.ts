import { onBeforeUnmount } from 'vue'
import { useUIStore } from '@/stores/ui'

export interface DirtyFormController {
  id: string
  isDirty: () => boolean
  save: () => boolean | Promise<boolean>
  discard: () => void
}

export function useDirtyForm(controller: DirtyFormController) {
  const uiStore = useUIStore()
  const unregister = uiStore.registerDirtyForm(controller)
  onBeforeUnmount(unregister)

  async function requestClose(): Promise<boolean> {
    if (!controller.isDirty()) {
      controller.discard()
      return true
    }
    const decision = await uiStore.showDirtyFormPrompt(controller.id)
    if (decision === 'cancel')
      return false
    if (decision === 'discard') {
      controller.discard()
      return true
    }
    try {
      return await controller.save() && !controller.isDirty()
    }
    catch {
      return false
    }
  }

  return { unregister, requestClose }
}

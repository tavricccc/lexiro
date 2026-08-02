import { onBeforeUnmount } from 'vue'
import { useUIStore } from '@/stores/ui'

export interface DirtyFormController {
  id: string
  isDirty: () => boolean
  save: () => boolean | Promise<boolean>
  discard: () => void
}

export function useDirtyForm(controller: DirtyFormController) {
  const unregister = useUIStore().registerDirtyForm(controller)
  onBeforeUnmount(unregister)
  return unregister
}

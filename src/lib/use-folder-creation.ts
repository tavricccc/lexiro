import type { VocabFolder } from '@/types'
import { ref } from 'vue'

export function useFolderCreation(createFolder: (name: string) => VocabFolder, requiredMessage: () => string) {
  const name = ref('')
  const error = ref('')

  function reset() {
    name.value = ''
    error.value = ''
  }

  function submit(): VocabFolder | null {
    const normalizedName = name.value.trim()
    if (!normalizedName) {
      error.value = requiredMessage()
      return null
    }
    try {
      const folder = createFolder(normalizedName)
      reset()
      return folder
    }
    catch (caught) {
      error.value = (caught as Error).message
      return null
    }
  }

  return { name, error, reset, submit }
}

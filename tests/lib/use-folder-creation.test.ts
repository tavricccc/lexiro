import type { VocabFolder } from '@/types'
import { describe, expect, it } from 'vitest'
import { useFolderCreation } from '@/lib/use-folder-creation'

function folder(name: string): VocabFolder {
  return { id: name, name, order: 0, createdAt: '', updatedAt: '' }
}

describe('useFolderCreation', () => {
  it('rejects blank names and exposes the localized validation message', () => {
    const form = useFolderCreation(folder, () => 'required')

    expect(form.submit()).toBeNull()
    expect(form.error.value).toBe('required')
  })

  it('normalizes the name, creates the folder, and resets the form', () => {
    const form = useFolderCreation(folder, () => 'required')
    form.name.value = '  Languages  '

    expect(form.submit()).toEqual(folder('Languages'))
    expect(form.name.value).toBe('')
    expect(form.error.value).toBe('')
  })
})

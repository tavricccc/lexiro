import type { VocabFolder } from '@/types'
import { describe, expect, it } from 'vitest'
import { ALL_FOLDER_ID, buildFolderOptions, createUncategorizedFolder, folderParentIdFromSelection, getFolderChildren, sortFolders, UNCATEGORIZED_FOLDER_ID } from '@/lib/folders'

const folders: VocabFolder[] = [
  { id: 'child-b', name: 'B', parentId: 'root', order: 1, createdAt: '', updatedAt: '' },
  { id: 'root', name: 'Root', order: 1, createdAt: '', updatedAt: '' },
  { id: 'child-a', name: 'A', parentId: 'root', order: 0, createdAt: '', updatedAt: '' },
  { id: 'root-first', name: 'First', order: 0, createdAt: '', updatedAt: '' },
]

describe('folder hierarchy helpers', () => {
  it('sorts by order and uses the name as a deterministic tie breaker', () => {
    expect(sortFolders([
      { ...folders[0], order: 0, name: 'Zulu' },
      { ...folders[1], order: 0, name: 'Alpha' },
    ]).map(folder => folder.id)).toEqual(['root', 'child-b'])
  })

  it('returns only the requested level in display order', () => {
    expect(getFolderChildren(folders).map(folder => folder.id)).toEqual(['root-first', 'root'])
    expect(getFolderChildren(folders, 'root').map(folder => folder.id)).toEqual(['child-a', 'child-b'])
  })

  it('keeps the root distinct from the real uncategorized folder', () => {
    const allFolders = [createUncategorizedFolder(), ...folders]
    const options = buildFolderOptions(allFolders)

    expect(options.find(option => option.id === UNCATEGORIZED_FOLDER_ID)).toMatchObject({ depth: 0, name: '未分類' })
    expect(folderParentIdFromSelection(ALL_FOLDER_ID)).toBeUndefined()
    expect(folderParentIdFromSelection(UNCATEGORIZED_FOLDER_ID)).toBeUndefined()
  })
})

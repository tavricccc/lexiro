import type { VocabFolder } from '@/types'

export const ALL_FOLDER_ID = '__all__'
export const UNCATEGORIZED_FOLDER_ID = '__uncategorized__'
export const UNCATEGORIZED_FOLDER_NAME = '未分類'

export interface FolderOption {
  id: string
  label: string
  name: string
  depth: number
  parentId?: string
}

export function createUncategorizedFolder(): VocabFolder {
  const timestamp = new Date(0).toISOString()
  return {
    id: UNCATEGORIZED_FOLDER_ID,
    name: UNCATEGORIZED_FOLDER_NAME,
    order: -1,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

/**
 * The uncategorized bucket is a destination for sets, not a real parent
 * folder. Treating it as a root selection keeps folder creation consistent
 * with file-explorer semantics.
 */
export function normalizeFolderParentId(parentId?: string): string | undefined {
  return parentId && parentId !== ALL_FOLDER_ID && parentId !== UNCATEGORIZED_FOLDER_ID
    ? parentId
    : undefined
}

export function sortFolders(folders: VocabFolder[]): VocabFolder[] {
  return [...folders].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
}

export function getFolderChildren(folders: VocabFolder[], parentId?: string): VocabFolder[] {
  return sortFolders(folders.filter(folder => folder.parentId === parentId))
}

export function buildFolderOptions(folders: VocabFolder[]): FolderOption[] {
  const byParent = new Map<string | undefined, VocabFolder[]>()
  for (const folder of folders) {
    const siblings = byParent.get(folder.parentId) ?? []
    siblings.push(folder)
    byParent.set(folder.parentId, siblings)
  }

  const options: FolderOption[] = []
  const visited = new Set<string>()

  function visit(parentId: string | undefined, depth: number) {
    for (const folder of sortFolders(byParent.get(parentId) ?? [])) {
      if (visited.has(folder.id))
        continue
      visited.add(folder.id)
      options.push({ id: folder.id, label: `${'— '.repeat(depth)}${folder.name}`, name: folder.name, depth, parentId: folder.parentId })
      visit(folder.id, depth + 1)
    }
  }

  visit(undefined, 0)
  return options
}

export function folderIdFromSelection(value: string): string {
  return value && value !== ALL_FOLDER_ID ? value : UNCATEGORIZED_FOLDER_ID
}

export function folderParentIdFromSelection(value: string): string | undefined {
  return normalizeFolderParentId(value)
}

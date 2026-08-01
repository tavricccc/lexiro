import type { VocabFolder } from '@/types'

export const ALL_FOLDER_ID = '__all__'
export const UNCATEGORIZED_FOLDER_ID = '__uncategorized__'

export interface FolderOption {
  id: string
  label: string
  depth: number
  parentId?: string
}

function sortFolders(folders: VocabFolder[]): VocabFolder[] {
  return [...folders].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
}

export function buildFolderOptions(folders: VocabFolder[], rootLabel: string): FolderOption[] {
  const byParent = new Map<string | undefined, VocabFolder[]>()
  for (const folder of folders) {
    const siblings = byParent.get(folder.parentId) ?? []
    siblings.push(folder)
    byParent.set(folder.parentId, siblings)
  }

  const options: FolderOption[] = [{ id: UNCATEGORIZED_FOLDER_ID, label: rootLabel, depth: 0 }]
  const visited = new Set<string>()

  function visit(parentId: string | undefined, depth: number) {
    for (const folder of sortFolders(byParent.get(parentId) ?? [])) {
      if (visited.has(folder.id))
        continue
      visited.add(folder.id)
      options.push({ id: folder.id, label: `${'— '.repeat(depth)}${folder.name}`, depth, parentId: folder.parentId })
      visit(folder.id, depth + 1)
    }
  }

  visit(undefined, 1)
  return options
}

export function folderIdFromSelection(value: string): string | undefined {
  return value === UNCATEGORIZED_FOLDER_ID ? undefined : value || undefined
}

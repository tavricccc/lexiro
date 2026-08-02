import type { useLibraryStore } from '@/stores/library'
import type { LibrarySet } from '@/types'

type LibraryStore = ReturnType<typeof useLibraryStore>

export function seedSet(libraryStore: LibraryStore, set: LibrarySet): void {
  const current = libraryStore.state
  const now = new Date().toISOString()
  libraryStore.state.words = Object.fromEntries(Object.entries(current.words).map(([wordKey, word]) => [wordKey, { ...word, updatedAt: word.updatedAt || now }]))
  libraryStore.state.sets = [...current.sets.filter(item => item.id !== set.id), { ...set, createdAt: set.createdAt || now, updatedAt: set.updatedAt || now }]
  libraryStore.state.memberships = { ...current.memberships, [set.id]: current.memberships[set.id] ?? [] }
}

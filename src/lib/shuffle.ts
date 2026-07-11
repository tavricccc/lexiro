import type { SessionEntry } from '@/types'

function shuffleArray<T>(items: T[]): T[] {
  const cloned = [...items]
  for (let index = cloned.length - 1; index > 0; index--) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    ;[cloned[index], cloned[randomIndex]] = [cloned[randomIndex], cloned[index]]
  }
  return cloned
}

/** Session-local option shuffle; does not mutate the source set. */
export function shuffleQuizEntry(entry: SessionEntry): SessionEntry {
  const opts = entry.item.question.opts
  const correct = opts[entry.item.question.ans]
  const shuffled = shuffleArray(opts)
  const ans = Math.max(0, shuffled.indexOf(correct))
  return {
    ...entry,
    item: {
      ...entry.item,
      question: {
        ...entry.item.question,
        opts: shuffled,
        ans,
      },
    },
  }
}

export function shuffleEntries<T>(entries: T[]): T[] {
  return shuffleArray(entries)
}

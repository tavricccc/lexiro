import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import type { LibraryState, SetSharePayload, SharedSet, WordEntry } from '@/types'
import {
  APP_NAME,
  EXPORT_VERSION,
  SET_SHARE_INTERNAL_FILENAME,
  SET_SHARE_MAX_ARCHIVE_BYTES,
  SET_SHARE_MAX_JSON_BYTES,
} from '@/constants'
import { questionBelongsToMemberships } from './question-ownership'
import { normalizeSharePayload } from './share'

function wordsForMemberships(library: LibraryState, setId: string): WordEntry[] {
  return (library.memberships[setId] ?? []).map((membership) => {
    const word = library.words[membership.wordKey]
    if (!word)
      throw new Error(`單字集指向未知單字：${membership.wordKey}`)
    const senseIds = new Set(membership.senseIds)
    const senses = word.senses.filter(sense => senseIds.has(sense.id))
    if (senses.length !== senseIds.size)
      throw new Error(`單字 ${word.word} 包含未知詞義`)
    return { ...word, senses }
  })
}

export function createSetSharePayload(library: LibraryState, setId: string): SetSharePayload {
  const set = library.sets.find(entry => entry.id === setId)
  if (!set)
    throw new Error('找不到要匯出的單字集')
  const memberships = library.memberships[setId] ?? []
  const sharedSet: SharedSet = {
    ...set,
    memberships: memberships.map(membership => ({
      wordKey: membership.wordKey,
      senseIds: [...membership.senseIds],
    })),
    words: wordsForMemberships(library, setId),
    questions: library.questions.filter(question => questionBelongsToMemberships(question, memberships)),
  }
  return normalizeSharePayload({
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    appName: APP_NAME,
    kind: 'set-share',
    sets: [sharedSet],
  })
}

function safeDownloadName(name: string): string {
  const forbidden = new Set(['<', '>', ':', '"', '/', '\\', '|', '?', '*'])
  const sanitized = [...name]
    .map(character => character.charCodeAt(0) < 32 || forbidden.has(character) ? '-' : character)
    .join('')
    .replace(/[. ]+$/gu, '')
    .trim()
  return sanitized || 'Lexiro'
}

export function downloadSetShare(payload: SetSharePayload): void {
  const bytes = zipSync({
    [SET_SHARE_INTERNAL_FILENAME]: strToU8(JSON.stringify(payload)),
  }) as Uint8Array<ArrayBuffer>
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${safeDownloadName(payload.sets[0]?.setName ?? 'Lexiro')}.lexiro.zip`
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function parseSetShareValue(value: unknown): SetSharePayload {
  return normalizeSharePayload(value)
}

export async function readSetShare(file: File): Promise<SetSharePayload> {
  if (file.size > SET_SHARE_MAX_ARCHIVE_BYTES)
    throw new Error('分享檔過大')
  const archive = unzipSync(new Uint8Array(await file.arrayBuffer()))
  const raw = archive[SET_SHARE_INTERNAL_FILENAME]
  if (!raw)
    throw new Error(`缺少 ${SET_SHARE_INTERNAL_FILENAME}`)
  if (raw.byteLength > SET_SHARE_MAX_JSON_BYTES)
    throw new Error('分享檔內容過大')
  return parseSetShareValue(JSON.parse(strFromU8(raw)) as unknown)
}

import type { AiSettings, DashboardStats, LearningProgress, LibraryState } from '@/types'
import { getShareableAiSettings } from './ai-provider'
import { cloneJson } from './clone'
import { canonicalHash } from './hash'

export type SyncDomain = 'library' | 'learning' | 'settings'
export type SyncRecords = Record<string, unknown>

export interface SyncOutboxEntry {
  id: string
  domain: SyncDomain
  recordKey: string
  baseHash: string
  payload: unknown | null
  attempts: number
  createdAt: string
  updatedAt: string
}

function isObjectPayload(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isMembershipPayload(value: unknown): value is LibraryState['memberships'][string] {
  return Array.isArray(value) && value.length > 0 && value.every((membership) => {
    if (!isObjectPayload(membership))
      return false
    return Object.keys(membership).every(key => key === 'wordKey' || key === 'senseIds')
      && typeof membership.wordKey === 'string'
      && Boolean(membership.wordKey.trim())
      && Array.isArray(membership.senseIds)
      && membership.senseIds.length > 0
      && membership.senseIds.every(senseId => typeof senseId === 'string' && Boolean(senseId.trim()))
  })
}

function hasRecordPrefix(recordKey: string, prefix: string): boolean {
  return recordKey.startsWith(prefix) && Boolean(recordKey.slice(prefix.length).trim())
}

function isRecordKeyForDomain(domain: SyncDomain, recordKey: string): boolean {
  if (domain === 'library')
    return ['word:', 'set:', 'membership:', 'folder:', 'question:'].some(prefix => hasRecordPrefix(recordKey, prefix))
  if (domain === 'learning')
    return hasRecordPrefix(recordKey, 'card:') || recordKey === 'stats:summary'
  return recordKey === 'settings:ai'
}

function isPayloadForRecord(domain: SyncDomain, recordKey: string, payload: unknown): boolean {
  if (!isRecordKeyForDomain(domain, recordKey))
    return false
  if (payload === null)
    return true
  if (domain === 'library') {
    if (hasRecordPrefix(recordKey, 'membership:'))
      return isMembershipPayload(payload)
    return ['word:', 'set:', 'folder:', 'question:'].some(prefix => hasRecordPrefix(recordKey, prefix))
      && isObjectPayload(payload)
  }
  if (domain === 'learning')
    return (hasRecordPrefix(recordKey, 'card:') || recordKey === 'stats:summary') && isObjectPayload(payload)
  return recordKey === 'settings:ai' && isObjectPayload(payload)
}

export function isSyncOutboxEntry(value: unknown): value is SyncOutboxEntry {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return false
  const entry = value as Record<string, unknown>
  return typeof entry.id === 'string'
    && (entry.domain === 'library' || entry.domain === 'learning' || entry.domain === 'settings')
    && typeof entry.recordKey === 'string'
    && typeof entry.baseHash === 'string'
    && isPayloadForRecord(entry.domain, entry.recordKey, entry.payload)
    && typeof entry.attempts === 'number'
    && Number.isInteger(entry.attempts)
    && entry.attempts >= 0
    && typeof entry.createdAt === 'string'
    && typeof entry.updatedAt === 'string'
}

export function recordHash(value: unknown): string {
  return canonicalHash(value ?? null)
}

export function outboxEntriesForDomain(entries: SyncOutboxEntry[], domain: SyncDomain): SyncOutboxEntry[] {
  return entries.filter(entry => entry.domain === domain)
}

export function removeOutboxDomain(entries: SyncOutboxEntry[], domain: SyncDomain): SyncOutboxEntry[] {
  return entries.filter(entry => entry.domain !== domain)
}

export function hasOutboxDomain(entries: SyncOutboxEntry[], domain: SyncDomain): boolean {
  return entries.some(entry => entry.domain === domain)
}

export function incrementOutboxAttempts(entries: SyncOutboxEntry[], domain: SyncDomain, now = new Date().toISOString()): SyncOutboxEntry[] {
  return entries.map(entry => entry.domain === domain
    ? { ...entry, attempts: entry.attempts + 1, updatedAt: now }
    : entry)
}

export function libraryRecords(state: LibraryState): SyncRecords {
  const records: SyncRecords = {}
  for (const [wordKey, word] of Object.entries(state.words))
    records[`word:${wordKey}`] = word
  for (const set of state.sets)
    records[`set:${set.id}`] = set
  for (const [setId, memberships] of Object.entries(state.memberships))
    records[`membership:${setId}`] = memberships
  for (const folder of state.folders)
    records[`folder:${folder.id}`] = folder
  for (const question of state.questions)
    records[`question:${question.id}`] = question
  return records
}

export function learningRecords(progress: LearningProgress, stats: DashboardStats): SyncRecords {
  const records: SyncRecords = {
    'stats:summary': stats,
  }
  for (const [senseId, card] of Object.entries(progress.cards))
    records[`card:${senseId}`] = card
  return records
}

export function settingsRecords(settings: AiSettings): SyncRecords {
  return { 'settings:ai': getShareableAiSettings(settings) }
}

export function queueRecordChanges(domain: SyncDomain, baseline: SyncRecords, previous: SyncRecords, current: SyncRecords, existing: SyncOutboxEntry[], now = new Date().toISOString()): SyncOutboxEntry[] {
  const next = existing.map(cloneJson)
  const keys = new Set([...Object.keys(previous), ...Object.keys(current)])
  for (const recordKey of keys) {
    if (recordHash(previous[recordKey]) === recordHash(current[recordKey]))
      continue
    const payload = current[recordKey] ?? null
    const existingIndex = next.findIndex(entry => entry.domain === domain && entry.recordKey === recordKey)
    const existingEntry = existingIndex >= 0 ? next[existingIndex] : undefined
    if (recordHash(payload) === recordHash(baseline[recordKey])) {
      if (existingIndex >= 0)
        next.splice(existingIndex, 1)
      continue
    }
    const queued: SyncOutboxEntry = {
      id: existingEntry?.id ?? `sync-${crypto.randomUUID()}`,
      domain,
      recordKey,
      baseHash: existingEntry?.baseHash ?? recordHash(baseline[recordKey]),
      payload: cloneJson(payload),
      attempts: existingEntry?.attempts ?? 0,
      createdAt: existingEntry?.createdAt ?? now,
      updatedAt: now,
    }
    if (existingIndex >= 0)
      next[existingIndex] = queued
    else
      next.push(queued)
  }
  return next
}

export function rebaseQueuedRecords(remote: SyncRecords, entries: SyncOutboxEntry[], domain: SyncDomain): { records: SyncRecords, accepted: SyncOutboxEntry[], conflicted: SyncOutboxEntry[] } {
  const records = { ...remote }
  const accepted: SyncOutboxEntry[] = []
  const conflicted: SyncOutboxEntry[] = []
  for (const entry of entries) {
    if (entry.domain !== domain)
      continue
    const remoteHash = recordHash(remote[entry.recordKey])
    if (remoteHash !== entry.baseHash) {
      if (remoteHash === recordHash(entry.payload))
        continue
      conflicted.push(entry)
      continue
    }
    if (entry.payload === null)
      delete records[entry.recordKey]
    else
      records[entry.recordKey] = cloneJson(entry.payload)
    accepted.push(entry)
  }
  return { records, accepted, conflicted }
}

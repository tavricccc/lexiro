import { describe, expect, it } from 'vitest'
import { deduplicateSetsByName, isRemoteSetNewer } from '@/lib/set-utils'

describe('set version policy', () => {
  it('keeps only the newest version for each set name', () => {
    const older = { id: 'old', setName: '高中英文', updatedAt: '2026-07-01T00:00:00.000Z' }
    const newer = { id: 'new', setName: '高中英文', updatedAt: '2026-07-02T00:00:00.000Z' }
    expect(deduplicateSetsByName([older, newer])).toEqual([newer])
  })

  it('uses the uploaded timestamp to resolve cloud versions', () => {
    expect(isRemoteSetNewer({ updatedAt: '2026-07-01T00:00:00.000Z' }, { updatedAt: '2026-07-02T00:00:00.000Z' })).toBe(true)
    expect(isRemoteSetNewer({ updatedAt: '2026-07-02T00:00:00.000Z' }, { updatedAt: '2026-07-01T00:00:00.000Z' })).toBe(false)
  })
})

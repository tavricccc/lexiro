import type { DocumentData, DocumentReference, Firestore } from 'firebase/firestore'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteDocIfUnchanged, setDocIfUnchanged } from '@/lib/firestore-cas'
import { stableHash } from '@/lib/hash'

const runTransaction = vi.hoisted(() => vi.fn())
vi.mock('firebase/firestore', () => ({ runTransaction }))

describe('firestore compare-and-set writes', () => {
  let current: Record<string, unknown> | null
  const transaction = {
    get: vi.fn(async () => ({
      exists: () => current !== null,
      data: () => current ?? {},
    })),
    set: vi.fn(),
    delete: vi.fn(),
  }
  const hash = (value: unknown | null) => value === null ? '' : stableHash(value)
  const db = {} as Firestore
  const reference = {} as DocumentReference<DocumentData>

  beforeEach(() => {
    current = { value: 1 }
    transaction.get.mockClear()
    transaction.set.mockClear()
    transaction.delete.mockClear()
    runTransaction.mockImplementation(async (...args: unknown[]) => {
      const update = args[1] as (value: typeof transaction) => Promise<unknown>
      return update(transaction)
    })
  })

  it('writes only when the Cloud document still matches the baseline', async () => {
    const result = await setDocIfUnchanged(db, reference, hash(current), { value: 2 }, hash)

    expect(result).toEqual({ written: true })
    expect(transaction.set).toHaveBeenCalledWith(reference, { value: 2 })
  })

  it('returns the current Cloud value without writing after a conflict', async () => {
    current = { value: 9 }
    const result = await setDocIfUnchanged(db, reference, hash({ value: 1 }), { value: 2 }, hash)

    expect(result).toEqual({ written: false, current: { value: 9 } })
    expect(transaction.set).not.toHaveBeenCalled()
  })

  it('treats an already deleted document as a successful delete', async () => {
    current = null
    const result = await deleteDocIfUnchanged(db, reference, hash({ value: 1 }), hash)

    expect(result).toEqual({ written: true })
    expect(transaction.delete).not.toHaveBeenCalled()
  })
})

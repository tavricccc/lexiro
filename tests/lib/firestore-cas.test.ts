import type { DocumentData, DocumentReference, Firestore } from 'firebase/firestore'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteDocIfUnchanged, setDocIfUnchanged, writeDocumentsIfUnchanged } from '@/lib/firestore-cas'
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
    runTransaction.mockClear()
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

  it('omits undefined object properties before sending data to Firestore', async () => {
    await setDocIfUnchanged(db, reference, hash(current), {
      items: [{ id: 'root-folder', parentId: undefined }],
    }, hash)

    expect(transaction.set).toHaveBeenCalledWith(reference, {
      items: [{ id: 'root-folder' }],
    })
  })

  it('rejects undefined array items with a local path before opening a transaction', async () => {
    await expect(setDocIfUnchanged(db, reference, hash(current), {
      items: ['valid', undefined],
    }, hash)).rejects.toThrow('document.items[1]')
    expect(runTransaction).not.toHaveBeenCalled()
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

  it('checks the commit marker before applying an atomic document group', async () => {
    current = { revision: 'current' }
    const written = await writeDocumentsIfUnchanged(db, [
      { reference, payload: { chunk: 1 } },
      { reference, expectedHash: 'stale', payload: { revision: 'next' }, hash: value => String((value as { revision?: string } | null)?.revision ?? '') },
    ])

    expect(written).toBe(false)
    expect(transaction.set).not.toHaveBeenCalled()
  })

  it('applies an atomic document group after its commit marker matches', async () => {
    current = { revision: 'current' }
    const written = await writeDocumentsIfUnchanged(db, [
      { reference, payload: { chunk: 1 } },
      { reference, expectedHash: 'current', payload: { revision: 'next' }, hash: value => String((value as { revision?: string } | null)?.revision ?? '') },
    ])

    expect(written).toBe(true)
    expect(transaction.set).toHaveBeenCalledTimes(2)
  })
})

import { describe, expect, it } from 'vitest'
import { canonicalHash } from '@/lib/hash'

describe('stable hash', () => {
  it('is invariant to object key order at every nesting level', () => {
    const first = { owner: 'user', items: [{ id: 'set-1', name: 'Set', nested: { z: 1, a: 2 } }] }
    const reordered = { items: [{ nested: { a: 2, z: 1 }, name: 'Set', id: 'set-1' }], owner: 'user' }

    expect(canonicalHash(first)).toBe(canonicalHash(reordered))
  })

  it('keeps array order significant', () => {
    expect(canonicalHash(['a', 'b'])).not.toBe(canonicalHash(['b', 'a']))
  })
})

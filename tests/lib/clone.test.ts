import { describe, expect, it } from 'vitest'
import { cloneJson } from '@/lib/clone'

describe('cloneJson', () => {
  it('returns an independent JSON-safe copy', () => {
    const source = { nested: { values: ['one'] } }
    const copy = cloneJson(source)

    copy.nested.values.push('two')

    expect(source.nested.values).toEqual(['one'])
    expect(copy).toEqual({ nested: { values: ['one', 'two'] } })
  })
})

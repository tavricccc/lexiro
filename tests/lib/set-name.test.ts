import { describe, expect, it } from 'vitest'
import { createUniqueSetName } from '@/lib/set-name'

describe('set name generation', () => {
  it('keeps an unused name unchanged', () => {
    expect(createUniqueSetName('Fruits', [])).toBe('Fruits')
  })

  it('increments until the generated name is unused', () => {
    expect(createUniqueSetName('Fruits', ['Fruits', 'Fruits (2)'])).toBe('Fruits (3)')
  })
})

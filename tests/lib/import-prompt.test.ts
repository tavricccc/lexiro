import { describe, expect, it } from 'vitest'
import { buildImportPrompt } from '@/lib/importPrompt'

describe('buildImportPrompt', () => {
  it('injects trimmed words and the requested difficulty', () => {
    const prompt = buildImportPrompt('  adapt, resilient  ', 3)

    expect(prompt).toContain('adapt, resilient')
    expect(prompt).toContain('"difficulty": 3')
    expect(prompt).toContain('標準學測長難句')
    expect(prompt).not.toContain('{{DIFFICULTY_NUM}}')
  })

  it('falls back to medium difficulty instructions for an unknown level', () => {
    const prompt = buildImportPrompt('clarify', 99)

    expect(prompt).toContain('高中段考入門')
    expect(prompt).toContain('"difficulty": 2')
  })
})

import { describe, expect, it } from 'vitest'
import { buildImportPrompt } from '@/lib/importPrompt'

describe('buildImportPrompt', () => {
  it('injects trimmed words and requests only word metadata', () => {
    const prompt = buildImportPrompt('  adapt, resilient  ')

    expect(prompt).toContain('adapt, resilient')
    expect(prompt).toContain('word')
    expect(prompt).toContain('pos')
    expect(prompt).toContain('meaning')
    expect(prompt).not.toContain('example')
    expect(prompt).not.toContain('question')
  })
})

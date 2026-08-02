import { describe, expect, it } from 'vitest'
import { buildImportPrompt } from '@/lib/importPrompt'

describe('buildImportPrompt', () => {
  it('keeps only useful source metadata in the word prompt', () => {
    const prompt = buildImportPrompt('  adapt, resilient  ')

    expect(prompt).toContain('"word": "adapt"')
    expect(prompt).not.toContain('"input"')
    expect(prompt).toContain('source-1')
    expect(prompt).toContain('sourceRef')
    expect(prompt).toContain('word')
    expect(prompt).toContain('pos')
    expect(prompt).toContain('meaning')
    expect(prompt).toContain('examples')
    expect(prompt).not.toContain('"word":"單字"')
    expect(prompt).not.toContain('question')
  })

  it('switches the example contract explicitly', () => {
    expect(buildImportPrompt('adapt', undefined, true)).toContain('每個 sense 必須提供一個自然、全英文的例句')
    expect(buildImportPrompt('adapt', undefined, false)).toContain('examples 必須是空陣列')
  })
})

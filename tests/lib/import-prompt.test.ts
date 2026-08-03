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
    expect(prompt).toContain('輸出前請在心中自我驗證')
    expect(prompt).toContain('不要輸出驗證或推理過程')
    expect(prompt).not.toContain('"word":"單字"')
    expect(prompt).not.toContain('question')
  })

  it('switches the example contract explicitly', () => {
    const withExamples = buildImportPrompt('adapt', undefined, true)
    expect(withExamples).toContain('每個 sense 的 examples 必須恰好包含一個自然英文例句')
    expect(withExamples).toContain('We adapt quickly.')
    expect(buildImportPrompt('adapt', undefined, false)).toContain('examples 必須是空陣列')
  })
})

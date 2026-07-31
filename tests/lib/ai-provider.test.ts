import { describe, expect, it, vi } from 'vitest'
import { defaultAiSettings, extractJsonText, generateWithAi } from '@/lib/ai-provider'

describe('AI provider adapter', () => {
  it('extracts JSON from fenced or explanatory responses', () => {
    expect(extractJsonText('Here you go:\n```json\n{"items":[]}\n```')).toBe('{"items":[]}')
    expect(extractJsonText('Result: {"items":[]}')).toBe('{"items":[]}')
  })

  it('uses the OpenAI-compatible request shape', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: '{"items":[]}' } }] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await generateWithAi({ ...defaultAiSettings, apiKey: 'test-key', enabled: true }, 'make JSON')
    expect(result).toBe('{"items":[]}')
    expect(fetchMock).toHaveBeenCalledWith('https://api.openai.com/v1/chat/completions', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer test-key' }),
    }))
  })
})

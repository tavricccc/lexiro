import { describe, expect, it, vi } from 'vitest'
import { defaultAiSettings, extractJsonText, generateWithAi, parseAiSettingsJson } from '@/lib/ai-provider'

describe('aI provider adapter', () => {
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

  it('supports plain-text responses for AI explanations', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: '這是解析內容' } }] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await generateWithAi({ ...defaultAiSettings, apiKey: 'test-key', enabled: true }, 'explain this', { responseFormat: 'text' })
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit

    expect(result).toBe('這是解析內容')
    expect(JSON.parse(String(request.body))).not.toHaveProperty('response_format')
  })

  it('imports the exported envelope and clamps unsafe batch sizes', () => {
    const settings = parseAiSettingsJson(JSON.stringify({
      version: 1,
      settings: { provider: 'custom', model: 'local-model', apiKey: 'secret', batchSize: 99 },
    }))

    expect(settings.provider).toBe('custom')
    expect(settings.model).toBe('local-model')
    expect(settings.apiKey).toBe('secret')
    expect(settings.batchSize).toBe(20)
  })
})

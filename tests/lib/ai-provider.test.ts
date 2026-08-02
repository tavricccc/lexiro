import { describe, expect, it, vi } from 'vitest'
import { AI_API_KEY_STORAGE_KEY, AI_SETTINGS_KEY } from '@/constants'
import { defaultAiSettings, extractJsonText, generateWithAi, loadAiSettings, loadAiSettingsState, parseAiSettingsJson, saveAiSettings } from '@/lib/ai-provider'
import { loadFromStorage, setStorageNamespace } from '@/lib/persist'

describe('aI provider adapter', () => {
  it('extracts JSON from fenced or explanatory responses', () => {
    expect(extractJsonText('Here you go:\n```json\n{"kind":"words","words":[]}\n```')).toBe('{"kind":"words","words":[]}')
    expect(extractJsonText('Result: {"kind":"words","words":[]}')).toBe('{"kind":"words","words":[]}')
  })

  it('uses the OpenAI-compatible request shape', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: '{"kind":"words","words":[]}' } }] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await generateWithAi({ ...defaultAiSettings, apiKey: 'test-key', enabled: true }, 'make JSON')
    expect(result).toBe('{"kind":"words","words":[]}')
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
      exportedAt: '2026-08-01T00:00:00.000Z',
      settings: { enabled: true, provider: 'custom', baseUrl: '', model: 'local-model', batchSize: 99 },
    }))

    expect(settings.provider).toBe('custom')
    expect(settings.model).toBe('local-model')
    expect(settings.apiKey).toBe('')
    expect(settings.batchSize).toBe(20)
  })

  it('rejects API keys and unknown fields in settings imports', () => {
    expect(() => parseAiSettingsJson(JSON.stringify({
      version: 1,
      exportedAt: '2026-08-01T00:00:00.000Z',
      settings: { enabled: true, provider: 'openai', baseUrl: '', model: 'gpt-4o-mini', batchSize: 10, apiKey: 'secret' },
    }))).toThrow('apiKey')
  })

  it('keeps the API key device-local while scoping shareable settings', async () => {
    setStorageNamespace('ai-guest')
    saveAiSettings({ ...defaultAiSettings, apiKey: 'device-secret', model: 'guest-model' })
    await loadAiSettingsState()

    await expect(loadFromStorage(AI_SETTINGS_KEY)).resolves.toEqual({
      value: JSON.stringify({ enabled: false, provider: 'openai', baseUrl: '', model: 'guest-model', batchSize: 10 }),
    })
    await expect(loadFromStorage(AI_API_KEY_STORAGE_KEY)).resolves.toEqual({ value: 'device-secret' })

    setStorageNamespace('ai-account')
    await loadAiSettingsState()
    expect(loadAiSettings()).toMatchObject({ model: 'gpt-4o-mini', apiKey: 'device-secret' })

    setStorageNamespace('ai-guest')
    await loadAiSettingsState()
    expect(loadAiSettings()).toMatchObject({ model: 'guest-model', apiKey: 'device-secret' })
    setStorageNamespace('guest')
  })
})

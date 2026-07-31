import type { AiProvider, AiSettings } from '@/types'
import { AI_SETTINGS_KEY } from '@/constants'

export const defaultAiSettings: AiSettings = {
  enabled: false,
  provider: 'openai',
  apiKey: '',
  baseUrl: '',
  model: 'gpt-4o-mini',
  batchSize: 10,
}

export interface AiGenerationOptions {
  responseFormat?: 'json' | 'text'
}

const aiProviders: AiProvider[] = ['openai', 'anthropic', 'google', 'custom']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function normalizeAiSettings(value: unknown): AiSettings {
  if (!isRecord(value))
    throw new Error('AI 設定格式不正確')

  const provider = aiProviders.includes(value.provider as AiProvider) ? value.provider as AiProvider : defaultAiSettings.provider
  const batchSize = Number(value.batchSize)

  return {
    enabled: value.enabled === true,
    provider,
    apiKey: typeof value.apiKey === 'string' ? value.apiKey : '',
    baseUrl: typeof value.baseUrl === 'string' ? value.baseUrl : '',
    model: typeof value.model === 'string' && value.model.trim() ? value.model : defaultAiSettings.model,
    batchSize: Number.isFinite(batchSize) ? Math.min(Math.max(Math.round(batchSize), 5), 20) : defaultAiSettings.batchSize,
  }
}

export function loadAiSettings(): AiSettings {
  try {
    const raw = localStorage.getItem(AI_SETTINGS_KEY)
    return raw ? normalizeAiSettings(JSON.parse(raw)) : { ...defaultAiSettings }
  }
  catch {
    return { ...defaultAiSettings }
  }
}

export function parseAiSettingsJson(raw: string): AiSettings {
  const parsed: unknown = JSON.parse(raw)
  const payload = isRecord(parsed) && 'settings' in parsed ? parsed.settings : parsed
  return normalizeAiSettings(payload)
}

export function downloadAiSettings(settings: AiSettings): void {
  const payload = JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: normalizeAiSettings(settings),
  }, null, 2)
  const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'lexiro-ai-settings.json'
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function saveAiSettings(settings: AiSettings) {
  localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(normalizeAiSettings(settings)))
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function openAiUrl(settings: AiSettings) {
  return settings.baseUrl.trim() || 'https://api.openai.com/v1/chat/completions'
}

function googleUrl(settings: AiSettings) {
  return settings.baseUrl.trim() || `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(settings.model)}:generateContent`
}

export async function generateWithAi(settings: AiSettings, prompt: string, options: AiGenerationOptions = {}): Promise<string> {
  if (!settings.apiKey.trim())
    throw new Error('請先在設定中填入 API key')

  const provider: AiProvider = settings.provider
  const responseFormat = options.responseFormat ?? 'json'
  let url = ''
  let headers: Record<string, string> = { 'Content-Type': 'application/json' }
  let body: Record<string, unknown>

  if (provider === 'anthropic') {
    url = settings.baseUrl.trim() || 'https://api.anthropic.com/v1/messages'
    headers = {
      ...headers,
      'x-api-key': settings.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    }
    body = {
      model: settings.model,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }
  }
  else if (provider === 'google') {
    url = googleUrl(settings)
    headers = { ...headers, 'x-goog-api-key': settings.apiKey }
    body = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      ...(responseFormat === 'json' ? { generationConfig: { responseMimeType: 'application/json' } } : {}),
    }
  }
  else {
    url = openAiUrl(settings)
    headers = { ...headers, Authorization: `Bearer ${settings.apiKey}` }
    body = {
      model: settings.model,
      messages: [{ role: 'user', content: prompt }],
      ...(responseFormat === 'json' ? { response_format: { type: 'json_object' } } : {}),
    }
  }

  const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
  if (!response.ok)
    throw new Error(`AI 請求失敗（${response.status}）`)
  const data = await response.json() as Record<string, unknown>

  if (provider === 'anthropic') {
    const content = Array.isArray(data.content) ? data.content : []
    return content.map(item => normalizeText((item as Record<string, unknown>).text)).join('')
  }
  if (provider === 'google') {
    const candidates = Array.isArray(data.candidates) ? data.candidates : []
    const parts = ((candidates[0] as Record<string, unknown> | undefined)?.content as Record<string, unknown> | undefined)?.parts
    return Array.isArray(parts) ? parts.map(item => normalizeText((item as Record<string, unknown>).text)).join('') : ''
  }

  const choices = Array.isArray(data.choices) ? data.choices : []
  return normalizeText(((choices[0] as Record<string, unknown> | undefined)?.message as Record<string, unknown> | undefined)?.content)
}

export function extractJsonText(text: string): string {
  const fenceStart = text.indexOf('```')
  if (fenceStart >= 0) {
    const contentStart = text.indexOf('\n', fenceStart)
    const fenceEnd = contentStart >= 0 ? text.indexOf('```', contentStart + 1) : -1
    if (contentStart >= 0 && fenceEnd > contentStart)
      return text.slice(contentStart + 1, fenceEnd).trim()
  }
  const objectStart = text.indexOf('{')
  const objectEnd = text.lastIndexOf('}')
  return objectStart >= 0 && objectEnd > objectStart ? text.slice(objectStart, objectEnd + 1) : text.trim()
}

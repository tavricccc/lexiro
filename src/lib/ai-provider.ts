import type { AiProvider, AiSettings } from '@/types'
import { AI_API_KEY_STORAGE_KEY, AI_SETTINGS_KEY } from '@/constants'
import { loadFromStorage, saveToStorage } from '@/lib/persist'
import { isRecord } from './schema'

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
let storedSettings: AiSettings = { ...defaultAiSettings }
const settingsListeners = new Set<(settings: AiSettings) => void>()
let settingsPersistencePromise: Promise<void> = Promise.resolve()

function assertKnownSettingsKeys(value: Record<string, unknown>, includeApiKey: boolean): void {
  const allowed = includeApiKey
    ? ['enabled', 'provider', 'apiKey', 'baseUrl', 'model', 'batchSize']
    : ['enabled', 'provider', 'baseUrl', 'model', 'batchSize']
  const unknown = Object.keys(value).filter(key => !allowed.includes(key))
  if (unknown.length)
    throw new Error(`AI 設定包含不支援欄位：${unknown.join('、')}`)
}

export function normalizeShareableAiSettings(value: unknown): Omit<AiSettings, 'apiKey'> {
  if (!isRecord(value))
    throw new Error('AI 設定格式不正確')
  assertKnownSettingsKeys(value, false)
  if (typeof value.enabled !== 'boolean' || typeof value.provider !== 'string' || !aiProviders.includes(value.provider as AiProvider) || typeof value.baseUrl !== 'string' || typeof value.model !== 'string' || !value.model.trim() || typeof value.batchSize !== 'number' || !Number.isFinite(value.batchSize))
    throw new Error('AI 設定欄位格式錯誤')
  return {
    enabled: value.enabled,
    provider: value.provider as AiProvider,
    baseUrl: value.baseUrl,
    model: value.model.trim(),
    batchSize: Math.min(Math.max(Math.round(value.batchSize), 5), 20),
  }
}

export function normalizeAiSettings(value: unknown): AiSettings {
  if (!isRecord(value))
    throw new Error('AI 設定格式不正確')
  assertKnownSettingsKeys(value, true)
  if (typeof value.apiKey !== 'string')
    throw new Error('AI 設定欄位格式錯誤')
  return {
    ...normalizeShareableAiSettings(Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'apiKey'))),
    apiKey: value.apiKey,
  }
}

export function loadAiSettings(): AiSettings {
  return { ...storedSettings }
}

function defaultShareableAiSettings(): Omit<AiSettings, 'apiKey'> {
  return getShareableAiSettings(defaultAiSettings)
}

export function getShareableAiSettings(settings = loadAiSettings()): Omit<AiSettings, 'apiKey'> {
  const { apiKey: _apiKey, ...shareable } = normalizeAiSettings(settings)
  return shareable
}

export function onAiSettingsChanged(listener: (settings: AiSettings) => void): () => void {
  settingsListeners.add(listener)
  return () => settingsListeners.delete(listener)
}

export async function loadAiSettingsState(): Promise<AiSettings> {
  const [stored, storedApiKey] = await Promise.all([
    loadFromStorage(AI_SETTINGS_KEY),
    loadFromStorage(AI_API_KEY_STORAGE_KEY),
  ])
  let shareableSettings = defaultShareableAiSettings()
  try {
    if (stored.value)
      shareableSettings = normalizeShareableAiSettings(JSON.parse(stored.value))
  }
  catch {
    shareableSettings = defaultShareableAiSettings()
  }
  storedSettings = { ...shareableSettings, apiKey: storedApiKey.value ?? '' }
  return loadAiSettings()
}

export async function waitForAiSettingsPersistence(): Promise<void> {
  await settingsPersistencePromise
}

export function parseAiSettingsJson(raw: string): AiSettings {
  const parsed: unknown = JSON.parse(raw)
  if (!isRecord(parsed))
    throw new Error('AI 設定必須是 object')
  if (Object.keys(parsed).some(key => !['version', 'exportedAt', 'settings'].includes(key)) || parsed.version !== 1 || typeof parsed.exportedAt !== 'string' || !parsed.exportedAt.trim() || !isRecord(parsed.settings))
    throw new Error('AI 設定匯出格式錯誤')
  const payload = parsed.settings
  return { ...normalizeShareableAiSettings(payload), apiKey: '' }
}

export function downloadAiSettings(settings: AiSettings): void {
  const shareableSettings = getShareableAiSettings(settings)
  const payload = JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: shareableSettings,
  }, null, 2)
  const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'lexiro-ai-settings.json'
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function saveAiSettings(settings: AiSettings) {
  storedSettings = normalizeAiSettings(settings)
  const shareableSettings = getShareableAiSettings(storedSettings)
  const apiKey = storedSettings.apiKey
  const settingsWrite = saveToStorage(AI_SETTINGS_KEY, shareableSettings)
  const apiKeyWrite = saveToStorage(AI_API_KEY_STORAGE_KEY, apiKey)
  const next = Promise.all([settingsPersistencePromise.catch(() => undefined), settingsWrite, apiKeyWrite]).then(() => undefined)
  settingsPersistencePromise = next
  void next.catch(() => undefined)
  for (const listener of settingsListeners)
    listener(loadAiSettings())
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

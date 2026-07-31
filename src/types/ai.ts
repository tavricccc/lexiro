export type AiProvider = 'openai' | 'anthropic' | 'google' | 'custom'

export interface AiSettings {
  enabled: boolean
  provider: AiProvider
  apiKey: string
  baseUrl: string
  model: string
  batchSize: number
}

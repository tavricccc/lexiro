import { describe, expect, it, vi } from 'vitest'
import { dictionaryAudio, dictionaryDefinitions, lookupDictionary } from '@/lib/dictionary'

const entry = {
  word: 'abandon',
  phonetic: '/əˈbændən/',
  phonetics: [{ text: '/əˈbændən/', audio: '//example.com/abandon.mp3' }],
  meanings: [{
    partOfSpeech: 'verb',
    definitions: [{ definition: 'to leave behind', example: 'They abandoned the plan.', synonyms: ['leave'], antonyms: ['keep'] }],
  }],
}

describe('dictionary client', () => {
  it('normalizes audio and definition details', () => {
    expect(dictionaryAudio(entry)).toBe('https://example.com/abandon.mp3')
    expect(dictionaryDefinitions(entry)).toEqual([{
      definition: 'to leave behind',
      example: 'They abandoned the plan.',
      synonyms: ['leave'],
      antonyms: ['keep'],
      partOfSpeech: 'verb',
    }])
  })

  it('fetches once and serves the next lookup from local cache', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([entry]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(lookupDictionary('abandon')).resolves.toHaveLength(1)
    await expect(lookupDictionary('abandon')).resolves.toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

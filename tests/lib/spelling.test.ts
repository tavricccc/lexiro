import { describe, expect, it } from 'vitest'
import { isSpellingAnswerCorrect, normalizeSpellingAnswer } from '@/lib/spelling'

describe('normalizeSpellingAnswer', () => {
  it('trims and lowercases', () => {
    expect(normalizeSpellingAnswer('  Apple  ')).toBe('apple')
  })

  it('collapses internal whitespace', () => {
    expect(normalizeSpellingAnswer('ice   cream')).toBe('ice cream')
  })
})

describe('isSpellingAnswerCorrect', () => {
  it('matches case-insensitively', () => {
    expect(isSpellingAnswerCorrect('APPLE', 'apple')).toBe(true)
  })

  it('rejects empty answers', () => {
    expect(isSpellingAnswerCorrect('   ', 'apple')).toBe(false)
    expect(isSpellingAnswerCorrect('', 'apple')).toBe(false)
  })

  it('matches after whitespace normalize', () => {
    expect(isSpellingAnswerCorrect('  ice   cream ', 'ice cream')).toBe(true)
  })
})

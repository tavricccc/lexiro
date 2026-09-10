import { describe, expect, it } from 'vitest'
import { canonicalHash, hashText, HASH_HEX_LENGTH } from '@/src/lib/hash'

describe('hashText', () => {
  it('matches published SHA-256 vectors, truncated to 128 bits', () => {
    expect(hashText('')).toBe('e3b0c44298fc1c149afbf4c8996fb924')
    expect(hashText('abc')).toBe('ba7816bf8f01cfea414140de5dae2223')
    expect(hashText('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe('248d6a61d20638b8e5c026930c3e6039')
  })

  it('hashes multi-byte text as UTF-8', () => {
    // The library is full of Chinese meanings, so the encoding has to be right.
    expect(hashText('漢字')).toBe('c6d297713595d2f5127b438aa2ec2cb3')
    expect(hashText('a').length).toBe(HASH_HEX_LENGTH)
  })

  it('spans block boundaries correctly', () => {
    // 55, 56 and 64 bytes exercise every padding branch.
    expect(hashText('a'.repeat(55))).toBe('9f4390f8d30c2dd92ec9f095b65e2b9a')
    expect(hashText('a'.repeat(56))).toBe('b35439a4ac6f0948b6d6f9e3c6af0f5f')
    expect(hashText('a'.repeat(64))).toBe('ffe054fe7ae0cb6dc65c3af9b61d5209')
  })
})

describe('canonicalHash', () => {
  it('ignores key order', () => {
    expect(canonicalHash({ a: 1, b: 2 })).toBe(canonicalHash({ b: 2, a: 1 }))
  })

  it('separates values that differ', () => {
    expect(canonicalHash({ a: 1 })).not.toBe(canonicalHash({ a: 2 }))
    expect(canonicalHash([1, 2])).not.toBe(canonicalHash([2, 1]))
  })

  it('drops undefined properties but keeps array holes positional', () => {
    expect(canonicalHash({ a: 1, b: undefined })).toBe(canonicalHash({ a: 1 }))
    expect(canonicalHash([undefined, 1])).toBe(canonicalHash([null, 1]))
  })

  it('produces a 128-bit hex digest', () => {
    expect(canonicalHash({ any: 'value' })).toMatch(/^[a-f0-9]{32}$/)
  })
})

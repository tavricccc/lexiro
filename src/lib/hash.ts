/**
 * Canonical hashing for record identity, content addressing and integrity
 * checks.
 *
 * The digest is SHA-256 truncated to 128 bits. A 32-bit hash is far too small
 * for the jobs these values do here: chunk ids are content addresses that
 * Firestore treats as immutable, and a sense id is the primary key of a
 * learner's review history. At 32 bits a few thousand records already carry a
 * measurable collision chance, and a collision would silently merge two
 * records or wedge cloud sync. 128 bits removes the concern outright.
 *
 * The implementation is synchronous on purpose: `crypto.subtle.digest` is
 * async, and every caller here hashes small values inside synchronous
 * normalization code.
 */

const ROUND_CONSTANTS = new Uint32Array([
  0x428A2F98, 0x71374491, 0xB5C0FBCF, 0xE9B5DBA5, 0x3956C25B, 0x59F111F1, 0x923F82A4, 0xAB1C5ED5,
  0xD807AA98, 0x12835B01, 0x243185BE, 0x550C7DC3, 0x72BE5D74, 0x80DEB1FE, 0x9BDC06A7, 0xC19BF174,
  0xE49B69C1, 0xEFBE4786, 0x0FC19DC6, 0x240CA1CC, 0x2DE92C6F, 0x4A7484AA, 0x5CB0A9DC, 0x76F988DA,
  0x983E5152, 0xA831C66D, 0xB00327C8, 0xBF597FC7, 0xC6E00BF3, 0xD5A79147, 0x06CA6351, 0x14292967,
  0x27B70A85, 0x2E1B2138, 0x4D2C6DFC, 0x53380D13, 0x650A7354, 0x766A0ABB, 0x81C2C92E, 0x92722C85,
  0xA2BFE8A1, 0xA81A664B, 0xC24B8B70, 0xC76C51A3, 0xD192E819, 0xD6990624, 0xF40E3585, 0x106AA070,
  0x19A4C116, 0x1E376C08, 0x2748774C, 0x34B0BCB5, 0x391C0CB3, 0x4ED8AA4A, 0x5B9CCA4F, 0x682E6FF3,
  0x748F82EE, 0x78A5636F, 0x84C87814, 0x8CC70208, 0x90BEFFFA, 0xA4506CEB, 0xBEF9A3F7, 0xC67178F2,
])

const encoder = new TextEncoder()
const schedule = new Uint32Array(64)

function rotateRight(value: number, bits: number): number {
  return (value >>> bits) | (value << (32 - bits))
}

function sha256(bytes: Uint8Array): Uint8Array {
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64
  const block = new Uint8Array(paddedLength)
  block.set(bytes)
  block[bytes.length] = 0x80
  const view = new DataView(block.buffer)
  const bitLength = bytes.length * 8
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000))
  view.setUint32(paddedLength - 4, bitLength % 0x100000000)

  let h0 = 0x6A09E667
  let h1 = 0xBB67AE85
  let h2 = 0x3C6EF372
  let h3 = 0xA54FF53A
  let h4 = 0x510E527F
  let h5 = 0x9B05688C
  let h6 = 0x1F83D9AB
  let h7 = 0x5BE0CD19

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1)
      schedule[index] = view.getUint32(offset + index * 4)
    for (let index = 16; index < 64; index += 1) {
      const previous = schedule[index - 15]!
      const recent = schedule[index - 2]!
      const s0 = rotateRight(previous, 7) ^ rotateRight(previous, 18) ^ (previous >>> 3)
      const s1 = rotateRight(recent, 17) ^ rotateRight(recent, 19) ^ (recent >>> 10)
      schedule[index] = (schedule[index - 16]! + s0 + schedule[index - 7]! + s1) >>> 0
    }

    let a = h0
    let b = h1
    let c = h2
    let d = h3
    let e = h4
    let f = h5
    let g = h6
    let h = h7

    for (let index = 0; index < 64; index += 1) {
      const s1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25)
      const choice = (e & f) ^ (~e & g)
      const temp1 = (h + s1 + choice + ROUND_CONSTANTS[index]! + schedule[index]!) >>> 0
      const s0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22)
      const majority = (a & b) ^ (a & c) ^ (b & c)
      const temp2 = (s0 + majority) >>> 0
      h = g
      g = f
      f = e
      e = (d + temp1) >>> 0
      d = c
      c = b
      b = a
      a = (temp1 + temp2) >>> 0
    }

    h0 = (h0 + a) >>> 0
    h1 = (h1 + b) >>> 0
    h2 = (h2 + c) >>> 0
    h3 = (h3 + d) >>> 0
    h4 = (h4 + e) >>> 0
    h5 = (h5 + f) >>> 0
    h6 = (h6 + g) >>> 0
    h7 = (h7 + h) >>> 0
  }

  const digest = new Uint8Array(32)
  const digestView = new DataView(digest.buffer)
  for (const [index, word] of [h0, h1, h2, h3, h4, h5, h6, h7].entries())
    digestView.setUint32(index * 4, word)
  return digest
}

/** Bytes of the digest kept. 16 bytes is 32 hex characters. */
export const HASH_BYTE_LENGTH = 16
export const HASH_HEX_LENGTH = HASH_BYTE_LENGTH * 2

function toHex(bytes: Uint8Array, byteLength: number): string {
  let hex = ''
  for (let index = 0; index < byteLength; index += 1)
    hex += bytes[index]!.toString(16).padStart(2, '0')
  return hex
}

/** Digest of a UTF-8 string. Exported so tests can check it against SHA-256 vectors. */
export function hashText(text: string): string {
  return toHex(sha256(encoder.encode(text)), HASH_BYTE_LENGTH)
}

/**
 * Sorts object keys and drops values JSON cannot represent, so two values that
 * serialize to the same data hash the same regardless of key order.
 */
function canonicalize(value: unknown, inArray = false): unknown {
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol')
    return inArray ? null : undefined
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return value
  if (typeof value === 'number')
    return Number.isFinite(value) ? value : null
  if (typeof value === 'bigint')
    throw new TypeError('Cannot hash a BigInt value')
  if (Array.isArray(value))
    return value.map(item => canonicalize(item, true))
  if (typeof value === 'object') {
    const normalized: Record<string, unknown> = {}
    for (const key of Object.keys(value).sort()) {
      const item = canonicalize((value as Record<string, unknown>)[key])
      if (item !== undefined)
        normalized[key] = item
    }
    return normalized
  }
  return value
}

export function canonicalHash(value: unknown): string {
  return hashText(JSON.stringify(canonicalize(value)) ?? 'undefined')
}

export function estimateJsonBytes(value: unknown): number {
  return encoder.encode(JSON.stringify(value)).byteLength
}

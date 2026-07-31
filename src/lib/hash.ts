export function stableHash(value: unknown): string {
  const input = JSON.stringify(value)
  let hash = 2166136261
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function estimateJsonBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength
}

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

export function stableHash(value: unknown): string {
  const input = JSON.stringify(value)
  let hash = 2166136261
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function canonicalHash(value: unknown): string {
  const input = JSON.stringify(canonicalize(value))
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

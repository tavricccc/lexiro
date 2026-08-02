const values = new Map<IDBValidKey, unknown>()

export async function get<T>(key: IDBValidKey): Promise<T | undefined> {
  return values.get(key) as T | undefined
}

export async function keys(): Promise<IDBValidKey[]> {
  return Array.from(values.keys())
}

export async function set<T>(key: IDBValidKey, value: T): Promise<void> {
  values.set(key, value)
}

export async function setMany(entries: Array<[IDBValidKey, unknown]>): Promise<void> {
  const next = new Map(values)
  for (const [key, value] of entries)
    next.set(key, value)
  values.clear()
  for (const [key, value] of next)
    values.set(key, value)
}

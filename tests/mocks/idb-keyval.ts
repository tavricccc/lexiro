const values = new Map<IDBValidKey, unknown>()

export async function get<T>(key: IDBValidKey): Promise<T | undefined> {
  return values.get(key) as T | undefined
}

export async function set<T>(key: IDBValidKey, value: T): Promise<void> {
  values.set(key, value)
}

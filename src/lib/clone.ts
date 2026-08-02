/** Clone JSON-safe data and strip Vue reactive proxies before crossing boundaries. */
export function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = []
  let nextIndex = 0
  const workerCount = Math.max(1, Math.min(Math.floor(concurrency), items.length || 1))

  async function runWorker() {
    while (true) {
      const index = nextIndex++
      if (index >= items.length)
        return
      results[index] = await worker(items[index], index)
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => runWorker()))
  return results
}

import { afterEach, describe, expect, it, vi } from 'vitest'

class FailingWorker {
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null

  postMessage(): void {
    queueMicrotask(() => this.onerror?.({ message: 'worker failed', error: new Error('worker failed') } as ErrorEvent))
  }

  terminate(): void {}
}

describe('backup worker bridge', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('rejects requests when the worker fails instead of leaving them pending', async () => {
    vi.stubGlobal('Worker', FailingWorker)
    const { buildExportZipBuffer } = await import('@/lib/worker')

    await expect(buildExportZipBuffer({ kind: 'set-share' })).rejects.toThrow('worker failed')
  })
})

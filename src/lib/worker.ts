import type { BackupWorkerError, BackupWorkerRequest, BackupWorkerResponse, BackupWorkerSuccess } from '@/types/backup-worker'
import { isRecord } from './schema'

let nextId = 0
const pending = new Map<string, { resolve: (value: BackupWorkerSuccess) => void, reject: (error: Error) => void }>()
let worker: Worker | null = null

function asError(value: unknown, fallback: string): Error {
  return value instanceof Error ? value : new Error(fallback)
}

function rejectPending(error: Error): void {
  const requests = Array.from(pending.values())
  pending.clear()
  for (const request of requests)
    request.reject(error)
}

function isWorkerResponse(value: unknown): value is BackupWorkerResponse {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.type !== 'string')
    return false
  if ('error' in value)
    return typeof value.error === 'string'
  if (value.type === 'export')
    return value.buffer instanceof ArrayBuffer
  return value.type === 'import' && 'result' in value
}

function isWorkerError(response: BackupWorkerResponse): response is BackupWorkerError {
  return 'error' in response
}

function getWorker(): Worker {
  if (!worker) {
    const createdWorker = new Worker(new URL('@/workers/backup.worker.ts', import.meta.url), { type: 'module' })
    worker = createdWorker
    createdWorker.onmessage = (e: MessageEvent<unknown>) => {
      if (!isWorkerResponse(e.data)) {
        const responseId = isRecord(e.data) && typeof e.data.id === 'string' ? e.data.id : ''
        const request = responseId ? pending.get(responseId) : undefined
        if (request) {
          pending.delete(responseId)
          request.reject(new Error('備份 Worker 回傳格式錯誤'))
        }
        return
      }
      const request = pending.get(e.data.id)
      if (!request)
        return
      pending.delete(e.data.id)
      if (isWorkerError(e.data))
        request.reject(new Error(e.data.error))
      else
        request.resolve(e.data)
    }
    createdWorker.onerror = (e) => {
      if (worker !== createdWorker)
        return
      worker = null
      createdWorker.terminate()
      rejectPending(asError(e.error, e.message || '備份 Worker 執行失敗'))
    }
  }
  return worker
}

function postAndWait(message: Omit<BackupWorkerRequest, 'id'>, transfer?: Transferable[]): Promise<BackupWorkerSuccess> {
  const id = String(++nextId)
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    try {
      const w = getWorker()
      const request: BackupWorkerRequest = { id, ...message } as BackupWorkerRequest
      if (transfer)
        w.postMessage(request, transfer)
      else
        w.postMessage(request)
    }
    catch (error) {
      pending.delete(id)
      reject(asError(error, '無法啟動備份 Worker'))
    }
  })
}

export async function buildExportZipBuffer(payload: unknown): Promise<ArrayBuffer> {
  const response = await postAndWait({ type: 'export', payload })
  if (response.type !== 'export')
    throw new Error('備份 Worker 回傳了不相容的 export 結果')
  return response.buffer
}

export async function parseBackupZipBufferInWorker(buffer: ArrayBuffer): Promise<unknown> {
  const response = await postAndWait({ type: 'import', payload: { buffer } }, [buffer])
  if (response.type !== 'import')
    throw new Error('備份 Worker 回傳了不相容的 import 結果')
  return response.result
}

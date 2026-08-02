import type { BackupWorkerRequest, BackupWorkerResponse } from '@/types/backup-worker'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { ZIP_INTERNAL_FILENAME } from '@/constants/backup'
import { isRecord } from '@/lib/schema'

interface BackupWorkerScope {
  postMessage: (message: BackupWorkerResponse, transfer?: Transferable[]) => void
  onmessage: ((event: MessageEvent<unknown>) => void) | null
}

const scope = globalThis as unknown as BackupWorkerScope

function isRequest(value: unknown): value is BackupWorkerRequest {
  if (!isRecord(value) || typeof value.id !== 'string' || (value.type !== 'export' && value.type !== 'import'))
    return false
  if (value.type === 'export')
    return true
  return isRecord(value.payload) && value.payload.buffer instanceof ArrayBuffer
}

function postMessage(message: BackupWorkerResponse, transfer?: Transferable[]): void {
  scope.postMessage(message, transfer)
}

scope.onmessage = (e: MessageEvent<unknown>) => {
  if (!isRequest(e.data)) {
    const id = isRecord(e.data) && typeof e.data.id === 'string' ? e.data.id : 'unknown'
    postMessage({ id, type: 'error', error: '無效的 Worker 請求' })
    return
  }

  const { id, type, payload } = e.data

  if (type === 'export') {
    const jsonText = JSON.stringify(payload, null, 2)
    const zipped = zipSync({ [ZIP_INTERNAL_FILENAME]: strToU8(jsonText) }, { level: 5 })
    const buffer = new ArrayBuffer(zipped.byteLength)
    new Uint8Array(buffer).set(zipped)
    postMessage({ id, type: 'export', buffer }, [buffer])
    return
  }

  if (type === 'import') {
    try {
      const entries = unzipSync(new Uint8Array(payload.buffer))
      const jsonEntry = entries[ZIP_INTERNAL_FILENAME]
      if (!jsonEntry) {
        postMessage({ id, type: 'import', error: '找不到 JSON 檔案' })
        return
      }

      const result = JSON.parse(strFromU8(jsonEntry))
      postMessage({ id, type: 'import', result })
    }
    catch (err) {
      const message = err instanceof Error ? err.message : '備份檔解析失敗'
      postMessage({ id, type: 'import', error: message })
    }
    return
  }

  postMessage({ id, type, error: '未知的 Worker 請求類型' })
}

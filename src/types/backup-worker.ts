export type BackupWorkerRequest = (
  | { id: string, type: 'export', payload: unknown }
  | { id: string, type: 'import', payload: { buffer: ArrayBuffer } }
)

export type BackupWorkerSuccess = (
  | { id: string, type: 'export', buffer: ArrayBuffer }
  | { id: string, type: 'import', result: unknown }
)

export interface BackupWorkerError {
  id: string
  type: BackupWorkerRequest['type'] | 'error'
  error: string
}

export type BackupWorkerResponse = BackupWorkerSuccess | BackupWorkerError

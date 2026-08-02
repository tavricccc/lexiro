export type CloudSyncErrorCode
  = | 'cloud/app-check-initialization'
    | 'cloud/checksum-mismatch'
    | 'cloud/data-invalid'
    | 'cloud/not-configured'
    | 'cloud/outbox-invalid'
    | 'cloud/schema-unsupported'

export type SyncErrorKind
  = | 'aborted'
    | 'app-check'
    | 'auth'
    | 'blocked-client'
    | 'cloud-data'
    | 'cloud-schema'
    | 'network'
    | 'not-configured'
    | 'outbox'
    | 'permission'
    | 'persistence'
    | 'resource'
    | 'timeout'
    | 'unknown'

export class CloudSyncError extends Error {
  readonly code: CloudSyncErrorCode

  constructor(code: CloudSyncErrorCode, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'CloudSyncError'
    this.code = code
  }
}

export interface SyncErrorDetails {
  code: string
  kind: SyncErrorKind
  message: string
}

function errorMessage(error: unknown): string {
  if (error instanceof Error)
    return error.message
  if (typeof error === 'string')
    return error
  return String(error)
}

function errorCode(error: unknown): string {
  if (!error || typeof error !== 'object' || !('code' in error))
    return ''
  return typeof error.code === 'string' ? error.code : String(error.code)
}

export function syncErrorDetails(error: unknown): SyncErrorDetails {
  const message = errorMessage(error)
  const code = errorCode(error)
  const normalized = `${code} ${message}`.toLowerCase()

  if (code === 'cloud/app-check-initialization')
    return { code, kind: 'app-check', message }
  if (code === 'cloud/schema-unsupported')
    return { code, kind: 'cloud-schema', message }
  if (code === 'cloud/data-invalid' || code === 'cloud/checksum-mismatch')
    return { code, kind: 'cloud-data', message }
  if (code === 'cloud/outbox-invalid')
    return { code, kind: 'outbox', message }
  if (code === 'cloud/not-configured')
    return { code, kind: 'not-configured', message }
  if (normalized.includes('invalid-argument') || normalized.includes('unsupported field value'))
    return { code, kind: 'cloud-data', message }
  if (normalized.includes('err_blocked_by_client') || normalized.includes('blocked by client'))
    return { code, kind: 'blocked-client', message }
  if (normalized.includes('app check') || normalized.includes('appcheck') || normalized.includes('recaptcha') || normalized.includes('token is invalid'))
    return { code, kind: 'app-check', message }
  if (normalized.includes('permission-denied') || normalized.includes('missing or insufficient permissions'))
    return { code, kind: 'permission', message }
  if (normalized.includes('unauthenticated') || normalized.includes('auth/'))
    return { code, kind: 'auth', message }
  if (normalized.includes('failed-precondition') || normalized.includes('indexeddb') || normalized.includes('persistence') || normalized.includes('multiple tab'))
    return { code, kind: 'persistence', message }
  if (normalized.includes('deadline-exceeded') || normalized.includes('timeout'))
    return { code, kind: 'timeout', message }
  if (normalized.includes('resource-exhausted'))
    return { code, kind: 'resource', message }
  if (normalized.includes('aborted'))
    return { code, kind: 'aborted', message }
  if (normalized.includes('unavailable') || normalized.includes('network'))
    return { code, kind: 'network', message }
  return { code: code || 'unknown', kind: 'unknown', message }
}

export function isRetryableSyncError(error: unknown): boolean {
  return ['aborted', 'network', 'resource', 'timeout', 'unknown'].includes(syncErrorDetails(error).kind)
}

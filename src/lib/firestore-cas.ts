import type { DocumentData, DocumentReference, Firestore } from 'firebase/firestore'
import { runTransaction } from 'firebase/firestore'

export type ConditionalWriteResult = (
  | { written: true }
  | { written: false, current: unknown | null }
)

type CloudHash = (value: unknown | null) => string

export async function setDocIfUnchanged(db: Firestore, reference: DocumentReference<DocumentData>, expectedHash: string, payload: DocumentData, hash: CloudHash): Promise<ConditionalWriteResult> {
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference)
    const current = snapshot.exists() ? snapshot.data() : null
    if (hash(current) !== expectedHash)
      return { written: false, current }
    transaction.set(reference, payload)
    return { written: true }
  })
}

export async function deleteDocIfUnchanged(db: Firestore, reference: DocumentReference<DocumentData>, expectedHash: string, hash: CloudHash): Promise<ConditionalWriteResult> {
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference)
    if (!snapshot.exists())
      return { written: true }
    const current = snapshot.data()
    if (hash(current) !== expectedHash)
      return { written: false, current }
    transaction.delete(reference)
    return { written: true }
  })
}

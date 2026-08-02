import type { DocumentData, DocumentReference, Firestore } from 'firebase/firestore'
import { runTransaction } from 'firebase/firestore'
import { prepareFirestoreData } from './firestore-data'

export type ConditionalWriteResult = (
  | { written: true }
  | { written: false, current: unknown | null }
)

type CloudHash = (value: unknown | null) => string

export interface AtomicDocumentWrite {
  reference: DocumentReference<DocumentData>
  expectedHash?: string
  payload: DocumentData | null
  hash?: CloudHash
}

export async function writeDocumentsIfUnchanged(db: Firestore, writes: AtomicDocumentWrite[]): Promise<boolean> {
  const prepared = writes.map(write => ({
    ...write,
    payload: write.payload === null ? null : prepareFirestoreData(write.payload),
  }))
  return runTransaction(db, async (transaction) => {
    const snapshots = await Promise.all(prepared.map(write => write.expectedHash === undefined ? null : transaction.get(write.reference)))
    const matches = prepared.every((write, index) => {
      const snapshot = snapshots[index]
      if (write.expectedHash === undefined)
        return true
      if (!snapshot || !write.hash)
        return false
      if (write.payload === null && !snapshot.exists())
        return true
      const current = snapshot.exists() ? snapshot.data() : null
      return write.hash(current) === write.expectedHash
    })
    if (!matches)
      return false
    for (const [index, write] of prepared.entries()) {
      if (write.payload === null) {
        if (!snapshots[index] || snapshots[index]?.exists())
          transaction.delete(write.reference)
      }
      else {
        transaction.set(write.reference, write.payload)
      }
    }
    return true
  })
}

export async function setDocIfUnchanged(db: Firestore, reference: DocumentReference<DocumentData>, expectedHash: string, payload: DocumentData, hash: CloudHash): Promise<ConditionalWriteResult> {
  const firestorePayload = prepareFirestoreData(payload)
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference)
    const current = snapshot.exists() ? snapshot.data() : null
    if (hash(current) !== expectedHash)
      return { written: false, current }
    transaction.set(reference, firestorePayload)
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

export interface CloudSyncRuntime {
  auth: typeof import('firebase/auth')
  firestore: typeof import('firebase/firestore')
  firebase: typeof import('./firebase')
  remote: typeof import('./cloud-sync-remote')
}

let runtimePromise: Promise<CloudSyncRuntime> | null = null

export function loadCloudSyncRuntime(): Promise<CloudSyncRuntime> {
  runtimePromise ??= Promise.all([
    import('firebase/auth'),
    import('firebase/firestore'),
    import('./firebase'),
    import('./cloud-sync-remote'),
  ]).then(([auth, firestore, firebase, remote]) => ({ auth, firestore, firebase, remote }))
  return runtimePromise
}

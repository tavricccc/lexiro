import { defineStore } from 'pinia'
import { createCloudSyncCoordinator } from '@/lib/cloud-sync-coordinator'

export const useCloudSyncStore = defineStore('cloudSync', createCloudSyncCoordinator)

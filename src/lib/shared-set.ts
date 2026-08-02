import type { SharedSet } from '@/types'

export function countSharedSetSenses(targetSets: SharedSet[]): number {
  return targetSets.reduce((setTotal, set) => setTotal + set.memberships.reduce((membershipTotal, membership) => membershipTotal + membership.senseIds.length, 0), 0)
}

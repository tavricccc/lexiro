/**
 * Timing constants shared by the generation Durable Object and D1 maintenance.
 * Kept in a dependency-free module so importing it from either side cannot form a cycle.
 */

/** A single generation may stream for this long before the room aborts it (10 minutes). */
export const GENERATION_TIMEOUT_MS = 600_000;

/** Extra room added on top of the generation timeout before a held lease is considered stale. */
export const STALE_HOLD_MARGIN_MS = 300_000;

/**
 * A lease or charge may stay held this long after its attempt started before periodic
 * maintenance releases it. It MUST stay greater than GENERATION_TIMEOUT_MS so an upstream
 * generation that is still running is never reclaimed early (600s + 300s = 900s).
 */
export const STALE_HOLD_SECONDS =
  (GENERATION_TIMEOUT_MS + STALE_HOLD_MARGIN_MS) / 1000;

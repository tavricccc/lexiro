import type {
  D1Database,
  D1PreparedStatement,
  D1Result,
} from "@cloudflare/workers-types";

/** Rows one account may have D1 read for it per UTC day. */
export const DAILY_READ_LIMIT = 200_000;
/**
 * Requests that read fewer rows are not recorded, so a status poll costs no
 * write. The per-minute throttle bounds how much can slip through below it.
 */
export const READ_RECORD_MIN_ROWS = 10;

export interface ReadMeter {
  rows: number;
}

class MeteredStatement {
  constructor(
    readonly inner: D1PreparedStatement,
    private meter: ReadMeter,
  ) {}
  bind(...values: unknown[]) {
    return new MeteredStatement(this.inner.bind(...values), this.meter);
  }
  async all<T>() {
    const result = await this.inner.all<T>();
    this.meter.rows += result.meta.rows_read ?? 0;
    return result;
  }
  async run<T>() {
    const result = await this.inner.run<T>();
    this.meter.rows += result.meta.rows_read ?? 0;
    return result;
  }
  /** D1's first() reports no meta, so this reads through all(). */
  async first<T>(column?: string) {
    const row = (await this.all<Record<string, unknown>>()).results[0];
    if (!row) return null;
    return (column === undefined ? row : (row[column] ?? null)) as T;
  }
}

/** Wraps a D1 binding so every statement it runs adds its rows_read to meter. */
export function meterDatabase(db: D1Database, meter: ReadMeter): D1Database {
  return {
    prepare: (sql: string) => new MeteredStatement(db.prepare(sql), meter),
    batch: async (statements: MeteredStatement[]) => {
      const results: D1Result[] = await db.batch(
        statements.map((statement) => statement.inner),
      );
      for (const result of results) meter.rows += result.meta.rows_read ?? 0;
      return results;
    },
  } as unknown as D1Database;
}

/** Adds a request's reads to the account's count for the day. */
export function recordReads(
  db: D1Database,
  uid: string,
  rows: number,
  now = Date.now(),
) {
  return db
    .prepare(
      "INSERT INTO account_reads(uid,day,rows) VALUES(?1,?2,?3) ON CONFLICT(uid) DO UPDATE SET rows=CASE WHEN day=?2 THEN rows+?3 ELSE ?3 END,day=?2",
    )
    .bind(uid, new Date(now).toISOString().slice(0, 10), rows)
    .run();
}

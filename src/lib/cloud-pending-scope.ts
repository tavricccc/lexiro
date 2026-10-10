import type { LibraryRecordRef } from "./library-repository";
import type { CloudRecord } from "./cloud-records";
import type { PendingLibraryRefRemap } from "./sync-journal";
import { canonicalHash } from "./hash";
import { buildSetWordKey, normalizeWordKey } from "./library";

/**
 * Resolve only durably marked v1 pending sources against a complete v9 feed.
 * Normal scoped deletions must never expand to an independent imported copy.
 */
export function legacyPendingCloudRefRemaps(
  records: readonly CloudRecord[],
  legacySources: readonly LibraryRecordRef[],
  localSetIds: readonly string[],
): PendingLibraryRefRemap[] {
  const live = records.filter((record) => !record.deleted);
  const setIds = new Set([
    ...localSetIds,
    ...live
      .filter((record) => record.type === "set")
      .map((record) => record.recordKey),
  ]);
  const questions = new Set(
    live
      .filter((record) => record.type === "question")
      .map((record) => record.recordKey),
  );
  const words = new Map(
    live
      .filter((record) => record.type === "word")
      .map((record) => [record.recordKey, record]),
  );
  const remaps: PendingLibraryRefRemap[] = [];
  for (const source of legacySources) {
    const targets: LibraryRecordRef[] = [];
    if (source.kind === "word") {
      for (const setId of setIds) {
        const id = buildSetWordKey(setId, source.id);
        const spelling = words.get(id)?.payload?.word;
        if (
          typeof spelling !== "string" ||
          normalizeWordKey(spelling) !== source.id
        )
          continue;
        targets.push({ kind: "word", id });
      }
    } else if (source.kind === "question") {
      for (const setId of setIds) {
        const id = `question-${canonicalHash({ setId, id: source.id })}`;
        if (questions.has(id)) targets.push({ kind: "question", id });
      }
    }
    if (targets.length)
      remaps.push({ source: { kind: source.kind, id: source.id }, targets });
  }
  return remaps;
}

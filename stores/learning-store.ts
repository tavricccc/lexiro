import { t } from "@/lib/i18n";
import { create } from "zustand";
import { CLOUD_BLOB_PENDING_EVENT } from "@/constants";
import {
  calendarDay,
  emptyLearningRecord,
  mergeLearningRecords,
  overlayLearningRecord,
  parseLearningRecord,
  recordOwnAnswer,
  type DailyGoal,
  type LearningAnswer,
  type LearningRecord,
} from "@/src/lib/learning-record";
import { randomUUID } from "@/src/lib/id";
import { getStorageNamespace } from "@/src/lib/persist";

const key = () => `${getStorageNamespace()}:lexiro:learning-record:v1`;
/** Other devices' records as last pulled, a restored backup, and whether this device's own record still has to go up. */
const cloudKey = () => `${getStorageNamespace()}:lexiro:learning-cloud:v1`;
const deviceKey = () => `${getStorageNamespace()}:lexiro:device-id`;

interface CloudCache {
  devices: Record<string, LearningRecord>;
  backup: LearningRecord | null;
  dirty: boolean;
}
function readJson(storageKey: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(storageKey) ?? "null");
  } catch {
    return null;
  }
}
function readCache(): CloudCache {
  const value = readJson(cloudKey()) as Partial<CloudCache> | null;
  const devices: Record<string, LearningRecord> = {};
  if (value?.devices && typeof value.devices === "object")
    for (const [id, record] of Object.entries(value.devices))
      devices[id] = parseLearningRecord(record);
  return {
    devices,
    backup: value?.backup ? parseLearningRecord(value.backup) : null,
    // Nothing cached yet: whatever this device already holds has never gone up.
    dirty: value ? value.dirty === true : true,
  };
}
/** A stable id for this browser and account, so its cloud record is replaced rather than duplicated. */
export function learningDeviceId(): string {
  const existing = localStorage.getItem(deviceKey());
  if (existing) return existing;
  const id = randomUUID();
  localStorage.setItem(deviceKey(), id);
  return id;
}
function view(own: LearningRecord, cache: CloudCache): LearningRecord {
  const id = learningDeviceId();
  const others = Object.entries(cache.devices)
    .filter(([device]) => device !== id)
    .map(([, record]) => record);
  const merged = mergeLearningRecords([own, ...others]);
  return cache.backup ? overlayLearningRecord(merged, cache.backup) : merged;
}

interface LearningStore {
  /** The account's history across devices; what every screen shows. */
  record: LearningRecord;
  /** This device's own part, the only part it sends to the cloud. */
  own: LearningRecord;
  cache: CloudCache;
  /** The storage namespace the state was read from. */
  namespace: string;
  error: string;
  hydrate: () => void;
  answer: (answer: Omit<LearningAnswer, "day"> & { day?: string }) => void;
  setGoal: (goal: DailyGoal) => void;
  /** Takes in every device's record from the cloud. */
  applyCloud: (devices: Record<string, LearningRecord>) => void;
  /** Called once this device's record reached the cloud unchanged. */
  markPushed: (sent: LearningRecord) => void;
  /** Folds in a restored backup without counting the same answers twice. */
  restoreBackup: (record: LearningRecord) => void;
}
/** Save before publishing state, so a storage failure never claims persistence. */
export const useLearningStore = create<LearningStore>((set, get) => {
  const save = (own: LearningRecord, cache: CloudCache, notify: boolean) => {
    try {
      localStorage.setItem(key(), JSON.stringify(own));
      localStorage.setItem(cloudKey(), JSON.stringify(cache));
      set({ own, cache, record: view(own, cache), error: "" });
    } catch {
      set({ error: t("redesign.storageFailed") });
      return;
    }
    if (notify && typeof window !== "undefined")
      window.dispatchEvent(new Event(CLOUD_BLOB_PENDING_EVENT));
  };
  return {
    record: emptyLearningRecord(),
    own: emptyLearningRecord(),
    cache: { devices: {}, backup: null, dirty: false },
    namespace: "",
    error: "",
    hydrate: () => {
      const own = parseLearningRecord(readJson(key()));
      const cache = readCache();
      set({
        own,
        cache,
        record: view(own, cache),
        namespace: getStorageNamespace(),
        error: "",
      });
    },
    answer: (answer) => {
      const { own, record, cache } = get();
      save(
        recordOwnAnswer(own, record, {
          ...answer,
          day: answer.day ?? calendarDay(new Date()),
        }),
        { ...cache, dirty: true },
        true,
      );
    },
    setGoal: (goal) =>
      save(
        { ...get().own, goal, goalUpdatedAt: new Date().toISOString() },
        { ...get().cache, dirty: true },
        true,
      ),
    applyCloud: (devices) =>
      save(get().own, { ...get().cache, devices }, false),
    markPushed: (sent) => {
      if (get().own !== sent) return;
      save(sent, { ...get().cache, dirty: false }, false);
    },
    restoreBackup: (record) => {
      const { own, cache } = get();
      save(
        own,
        {
          ...cache,
          backup: cache.backup
            ? overlayLearningRecord(cache.backup, record)
            : record,
        },
        false,
      );
    },
  };
});

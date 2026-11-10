import { create } from "zustand";
import { calendarDay, emptyLearningRecord, parseLearningRecord, recordAnswer, type DailyGoal, type LearningAnswer, type LearningRecord } from "@/src/lib/learning-record";
import { getStorageNamespace } from "@/src/lib/persist";

const key = () => `${getStorageNamespace()}:lexiro:learning-record:v1`;
function read(): LearningRecord {
  try { return parseLearningRecord(JSON.parse(localStorage.getItem(key()) ?? "null")); }
  catch { return emptyLearningRecord(); }
}
interface LearningStore {
  record: LearningRecord;
  error: string;
  hydrate: () => void;
  answer: (answer: Omit<LearningAnswer, "day"> & { day?: string }) => void;
  setGoal: (goal: DailyGoal) => void;
}
/** Save before publishing state, so a storage failure never claims persistence. */
export const useLearningStore = create<LearningStore>((set, get) => {
  const save = (record: LearningRecord) => {
    try { localStorage.setItem(key(), JSON.stringify(record)); set({ record, error: "" }); }
    catch { set({ error: "儲存失敗" }); }
  };
  return {
    record: emptyLearningRecord(), error: "",
    hydrate: () => set({ record: read(), error: "" }),
    answer: answer => save(recordAnswer(get().record, { ...answer, day: answer.day ?? calendarDay(new Date()) })),
    setGoal: goal => save({ ...get().record, goal }),
  };
});

import { practiceTaskLabel } from "@/lib/practice-tasks";
import { accuracy } from "@/src/lib/learning-record";
import { useLearningStore } from "@/stores/learning-store";
import type { PracticeTask } from "@/types";
import { vars } from "./primitives";
export const learningKinds: PracticeTask[] = [
  "meaning",
  "vocabulary",
  "cloze",
  "wordBank",
  "discourse",
  "reading",
];
export function KindAccuracy({ compact = false }: { compact?: boolean }) {
  const record = useLearningStore((s) => s.record);
  return (
    <div className="kinds">
      {learningKinds.slice(0, compact ? 3 : 6).map((kind, i) => (
        <div
          className={`k hue-${["mint", "sky", "violet", "amber", "rose", "sky"][i]}`}
          key={kind}
        >
          <span>{practiceTaskLabel(kind)}</span>
          <div
            className="meter"
            style={vars({ "--v": `${accuracy(record.kinds[kind])}%` })}
          >
            <i />
          </div>
          <b>{accuracy(record.kinds[kind])}%</b>
        </div>
      ))}
    </div>
  );
}

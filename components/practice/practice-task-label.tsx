import type { PracticeTask } from "@/types";
import { practiceTaskLabel } from "@/lib/practice-tasks";

export function PracticeTaskLabel({ task }: { task: PracticeTask }) {
  return (
    <p className="chip">
      {practiceTaskLabel(task)}
    </p>
  );
}

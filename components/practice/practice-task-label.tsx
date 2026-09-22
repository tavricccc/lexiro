import type { PracticeTask } from "@/types";
import { practiceTaskLabel } from "@/lib/practice-tasks";

export function PracticeTaskLabel({ task }: { task: PracticeTask }) {
  return (
    <p className="mb-3 text-xs font-medium text-brand-600">
      {practiceTaskLabel(task)}
    </p>
  );
}

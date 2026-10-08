import type { PracticeTask } from "@/types";
import { practiceTaskLabel } from "@/lib/practice-tasks";

export function PracticeTaskLabel({ task }: { task: PracticeTask }) {
  return (
    <p className="text-xs font-medium text-brand-600">
      {practiceTaskLabel(task)}
    </p>
  );
}

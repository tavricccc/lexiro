import Link from "next/link";
import { Icons } from "@/components/ui/icons";
import { t } from "@/lib/i18n";

export function StudyProgress({
  href,
  label,
  value,
  goal,
  disabled = false,
  emptyHint,
}: {
  href: string;
  label: string;
  value: number;
  goal: number;
  disabled?: boolean;
  emptyHint?: string;
}) {
  const done = value >= goal;
  const contents = (
    <>
      <span className="study-check" data-done={done} aria-hidden="true">
        {done ? (
          <Icons.success className="size-4" />
        ) : (
          <Icons.start className="size-4" />
        )}
      </span>
      <span className="study-task-label">
        {label}
        <span>
          {disabled
            ? (emptyHint ?? t("home.noQuestionsYet"))
            : done
              ? t("home.goalDone")
              : t("home.keepGoing")}
        </span>
      </span>
      <span className="study-task-count">
        {value}
        <span> / {goal}</span>
      </span>
      <span
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={goal}
        aria-valuenow={Math.min(value, goal)}
        className="study-task-progress"
      >
        <span
          style={{
            transform: `scaleX(${goal > 0 ? Math.min(1, value / goal) : 1})`,
          }}
        />
      </span>
    </>
  );
  return disabled ? (
    <div className="study-task" aria-disabled="true">
      {contents}
    </div>
  ) : (
    <Link className="study-task" href={href}>
      {contents}
    </Link>
  );
}

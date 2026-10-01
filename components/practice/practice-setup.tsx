"use client";

import type {
  LibrarySet,
  PracticeTask,
  WorkspaceQuestionDifficulty,
} from "@/types";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BackControl } from "@/components/ui/back-control";
import { ChoiceChecklist } from "@/components/ui/choice-checklist";
import { DraftSaveStatus } from "@/components/ui/draft-save-status";
import { Icons } from "@/components/ui/icons";
import { EmptyState } from "@/components/ui/page-state";
import { ListPicker, ListSection, ListSwitchRow } from "@/components/ui/list";
import { StepFrame, StepRecap } from "@/components/ui/step-frame";
import { PRACTICE_TASKS } from "@/constants";
import { t } from "@/lib/i18n";
import type { DraftPersistence } from "@/lib/draft-persistence";
import { LIBRARY_QUESTIONS_HREF } from "@/lib/routes";
import { practiceTaskHint, practiceTaskLabel } from "@/lib/practice-tasks";
import { difficultyOptions } from "@/lib/question-options";
import { isPassageKind } from "@/src/lib/question-formats";

export function PracticeSetup({
  amount,
  availableQuestionCount,
  backHref,
  counts,
  difficulty,
  draftPersistence = "idle",
  hasWords,
  hasQuestionContent,
  leechOnly,
  oneSensePerWord,
  onAmountChange,
  onBegin,
  onDifficultyChange,
  onLeechOnlyChange,
  onOneSenseChange,
  onSetChange,
  onTasksChange,
  queueLength,
  setId,
  sets,
  tasks,
}: {
  amount: number;
  availableQuestionCount: number;
  backHref: string;
  counts: Record<PracticeTask, number>;
  difficulty: WorkspaceQuestionDifficulty;
  draftPersistence?: DraftPersistence;
  hasWords: boolean;
  hasQuestionContent: boolean;
  leechOnly: boolean;
  oneSensePerWord: boolean;
  onAmountChange: (amount: number) => void;
  onBegin: () => void;
  onDifficultyChange: (difficulty: WorkspaceQuestionDifficulty) => void;
  onLeechOnlyChange: (leechOnly: boolean) => void;
  onOneSenseChange: (oneSensePerWord: boolean) => void;
  onSetChange: (setId: string) => void;
  onTasksChange: (tasks: PracticeTask[]) => void;
  queueLength: number;
  setId: string;
  sets: LibrarySet[];
  tasks: PracticeTask[];
}) {
  const availableFormats = PRACTICE_TASKS.filter((task) => counts[task] > 0);
  const needsContent = !hasWords && !hasQuestionContent;
  const shownAmount = Math.min(amount, Math.max(1, availableQuestionCount));
  const footer = needsContent ? (
    <Button asChild className="w-full" size="lg">
      <Link href="/app/sets/new">
        <Icons.create />
        {t("practice.addWordsFirst")}
      </Link>
    </Button>
  ) : (
    <>
      <Button
        className="w-full"
        disabled={!queueLength}
        onClick={onBegin}
        size="lg"
      >
        <Icons.start />
        {queueLength
          ? t("practice.beginCount", { count: queueLength })
          : t("practice.noSelection")}
      </Button>
      <p className="mt-4 text-center">
        <Link
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          href={LIBRARY_QUESTIONS_HREF}
        >
          {t("practice.manageQuestions")}
        </Link>
      </p>
    </>
  );
  return (
    <StepFrame
      back={<BackControl href={backHref} />}
      current={1}
      total={1}
      status={<DraftSaveStatus status={draftPersistence} />}
      footer={footer}
      title={t("practice.scopeTitle")}
      recap={
        needsContent ? undefined : (
          <StepRecap
            items={[
              t("practice.readyQuestions", { count: availableQuestionCount }),
            ]}
          />
        )
      }
    >
      {needsContent ? (
        <EmptyState
          variant="filtered"
          title={t("practice.noContent")}
          description={t("practice.addWordsHint")}
        />
      ) : (
        <div className="space-y-7">
          <ListSection header={t("practice.scopeHeader")}>
            <ListPicker
              label={t("practice.set")}
              onChange={(value) => onSetChange(value === "all" ? "" : value)}
              options={[
                { label: t("practice.allSets"), value: "all" },
                ...sets.map((entry) => ({
                  label: entry.setName,
                  value: entry.id,
                })),
              ]}
              value={setId || "all"}
            />
            {availableQuestionCount > 0 && (
              <div className="py-4">
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <label className="type-row" htmlFor="practice-amount">
                    {t("practice.amount")}
                  </label>
                  <strong className="text-lg tabular-nums">
                    {t("practice.amountValue", { count: shownAmount })}
                  </strong>
                </div>
                <input
                  className="practice-amount-slider"
                  id="practice-amount"
                  max={availableQuestionCount}
                  min={1}
                  onChange={(event) =>
                    onAmountChange(Number(event.target.value))
                  }
                  type="range"
                  value={shownAmount}
                />
                <div className="flex justify-between text-xs tabular-nums text-muted-foreground">
                  <span>1</span>
                  <span>
                    {t("practice.amountMax", { count: availableQuestionCount })}
                  </span>
                </div>
              </div>
            )}
          </ListSection>
          <section>
            <h2 className="type-list-header mb-2 px-1">
              {t("practice.formatsTitle")}
            </h2>
            <ChoiceChecklist
              onToggle={(value, checked) =>
                onTasksChange(
                  PRACTICE_TASKS.filter((task) =>
                    task === value ? checked : tasks.includes(task),
                  ),
                )
              }
              options={availableFormats.map((task) => ({
                description: practiceTaskHint(task),
                icon:
                  task !== "meaning" &&
                  task !== "spelling" &&
                  isPassageKind(task)
                    ? Icons.reading
                    : Icons.question,
                label: practiceTaskLabel(task),
                meta: t("practice.formatReady", { count: counts[task] }),
                value: task,
              }))}
              selected={tasks}
            />
            {hasWords && counts.meaning === 0 && (
              <p className="mt-3 text-sm text-muted-foreground">
                {t("practice.meaningPoolHint")}
              </p>
            )}
          </section>
          <ListSection>
            <ListSwitchRow
              checked={oneSensePerWord}
              detail={t("practice.oneSenseHint")}
              label={t("practice.oneSensePerWord")}
              onCheckedChange={onOneSenseChange}
            />
            <ListSwitchRow
              checked={leechOnly}
              detail={t("practice.leechOnlyHint")}
              label={t("practice.leechOnly")}
              onCheckedChange={onLeechOnlyChange}
            />
            <ListPicker
              label={t("practice.difficulty")}
              onChange={(value) =>
                onDifficultyChange(value as WorkspaceQuestionDifficulty)
              }
              options={difficultyOptions(t("practice.allDifficulties"))}
              value={String(difficulty)}
            />
          </ListSection>
        </div>
      )}
    </StepFrame>
  );
}

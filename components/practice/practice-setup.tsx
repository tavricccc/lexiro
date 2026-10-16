"use client";

import type {
  LibrarySet,
  PracticeTask,
  WorkspaceQuestionDifficulty,
} from "@/types";
import Link from "@/components/ui/app-link";
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
  oneSensePerWord,
  onAmountChange,
  onBegin,
  onDifficultyChange,
  onOneSenseChange,
  onSetChange,
  onTasksChange,
  queueLength,
  setId,
  sets,
  tasks,
  title = t("practice.scopeTitle"),
  beginLabel = (count) => t("practice.beginCount", { count }),
  busy = false,
  maxAmount = Infinity,
  showDraftStatus = true,
  extraScope,
}: {
  amount: number;
  availableQuestionCount: number;
  backHref: string;
  counts: Record<PracticeTask, number>;
  difficulty: WorkspaceQuestionDifficulty;
  draftPersistence?: DraftPersistence;
  hasWords: boolean;
  hasQuestionContent: boolean;
  oneSensePerWord: boolean;
  onAmountChange: (amount: number) => void;
  onBegin: () => void;
  onDifficultyChange: (difficulty: WorkspaceQuestionDifficulty) => void;
  onOneSenseChange: (oneSensePerWord: boolean) => void;
  onSetChange: (setId: string) => void;
  onTasksChange: (tasks: PracticeTask[]) => void;
  queueLength: number;
  setId: string;
  sets: LibrarySet[];
  tasks: PracticeTask[];
  /** A live room reuses this screen to pick its questions. */
  title?: string;
  beginLabel?: (count: number) => string;
  busy?: boolean;
  /** Rooms cap how many questions one game can hold. */
  maxAmount?: number;
  showDraftStatus?: boolean;
  /** Extra controls under the amount slider, e.g. a room's seconds per question. */
  extraScope?: React.ReactNode;
}) {
  const sliderMax = Math.min(availableQuestionCount, maxAmount);
  const availableFormats = PRACTICE_TASKS.filter((task) => counts[task] > 0);
  const needsContent = !hasWords && !hasQuestionContent;
  const shownAmount = Math.min(amount, Math.max(1, sliderMax));
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
        disabled={!queueLength || busy}
        onClick={onBegin}
        size="lg"
      >
        <Icons.start />
        {queueLength ? beginLabel(queueLength) : t("practice.noSelection")}
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
      status={
        showDraftStatus ? (
          <DraftSaveStatus status={draftPersistence} />
        ) : undefined
      }
      footer={footer}
      title={title}
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
                  max={sliderMax}
                  min={1}
                  onChange={(event) =>
                    onAmountChange(Number(event.target.value))
                  }
                  type="range"
                  value={shownAmount}
                />
                <div className="flex justify-between text-xs tabular-nums text-muted-foreground">
                  <span>1</span>
                  <span>{t("practice.amountMax", { count: sliderMax })}</span>
                </div>
              </div>
            )}
            {extraScope}
          </ListSection>
          {[
            {
              title: t("practice.wordReview"),
              formats: availableFormats.filter((task) => task === "meaning"),
            },
            {
              title: t("practice.examFormats"),
              formats: availableFormats.filter((task) => task !== "meaning"),
            },
          ]
            .filter((group) => group.formats.length > 0)
            .map((group) => (
              <section key={group.title}>
                <h2 className="type-list-header mb-2 px-1">{group.title}</h2>
                <ChoiceChecklist
                  onToggle={(value, checked) =>
                    onTasksChange(
                      PRACTICE_TASKS.filter((task) =>
                        task === value ? checked : tasks.includes(task),
                      ),
                    )
                  }
                  options={group.formats.map((task) => ({
                    description: practiceTaskHint(task),
                    icon:
                      task !== "meaning" && isPassageKind(task)
                        ? Icons.reading
                        : Icons.question,
                    label: practiceTaskLabel(task),
                    meta: t("practice.formatReady", { count: counts[task] }),
                    value: task,
                  }))}
                  selected={tasks}
                />
              </section>
            ))}
          {hasWords && counts.meaning === 0 && (
            <p className="text-sm text-muted-foreground">
              {t("practice.meaningPoolHint")}
            </p>
          )}
          <ListSection>
            <ListSwitchRow
              checked={oneSensePerWord}
              detail={t("practice.oneSenseHint")}
              label={t("practice.oneSensePerWord")}
              onCheckedChange={onOneSenseChange}
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

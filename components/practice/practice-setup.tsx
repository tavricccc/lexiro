import { useState } from "react";
import type {
  LibrarySet,
  PracticeTask,
  WorkspaceQuestionDifficulty,
} from "@/types";
import Link from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { BackControl } from "@/components/ui/back-control";
import { LiquidTabs } from "@/components/ui/liquid-tabs";
import { DraftSaveStatus } from "@/components/ui/draft-save-status";
import { Icons } from "@/components/ui/icons";
import { EmptyState } from "@/components/ui/page-state";
import {
  ListMultiPicker,
  ListPicker,
  ListSection,
  ListSwitchRow,
} from "@/components/ui/list";
import { practiceScopeLabel } from "@/components/practice/use-practice-pool";
import { StepFrame } from "@/components/ui/step-frame";
import { PRACTICE_TASKS } from "@/constants";
import { t } from "@/lib/i18n";
import type { DraftPersistence } from "@/lib/draft-persistence";
import { practiceTaskHint, practiceTaskLabel } from "@/lib/practice-tasks";
import { difficultyOptions } from "@/lib/question-options";
import { isPassageKind } from "@/src/lib/question-formats";
import { isWordTask } from "@/components/practice/meaning-questions";

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
  onSetsChange,
  onTasksChange,
  queueLength,
  setIds,
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
  onSetsChange: (setIds: string[]) => void;
  onTasksChange: (tasks: PracticeTask[]) => void;
  queueLength: number;
  setIds: string[];
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
  // Practice picks a preset like the app; a room keeps its capped slider.
  const presets = Number.isFinite(maxAmount) ? null : AMOUNT_PRESETS;
  const [custom, setCustom] = useState(
    () => !AMOUNT_PRESETS.includes(amount),
  );
  const hasExam = tasks.some((task) => !isWordTask(task));
  const footer = needsContent ? (
    <Button asChild className="w-full" size="lg">
      <Link href="/app/sets/new">
        <Icons.create />
        {t("practice.addWordsFirst")}
      </Link>
    </Button>
  ) : (
    <Button
      className="min-h-[3.75rem] w-full"
      disabled={!tasks.length || !queueLength || busy}
      onClick={onBegin}
      size="lg"
    >
      <Icons.start />
      {queueLength ? beginLabel(queueLength) : t("practice.noSelection")}
    </Button>
  );
  const slider = (
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
        disabled={sliderMax < 2}
        id="practice-amount"
        max={Math.max(1, sliderMax)}
        min={1}
        onChange={(event) => onAmountChange(Number(event.target.value))}
        type="range"
        value={shownAmount}
      />
      <div className="flex justify-between text-xs tabular-nums text-muted-foreground">
        <span>1</span>
        <span>{t("practice.amountMax", { count: Math.max(1, sliderMax) })}</span>
      </div>
    </div>
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
            <ListMultiPicker
              allLabel={t("practice.allSets")}
              label={t("practice.set")}
              onChange={onSetsChange}
              options={sets.map((entry) => ({
                label: entry.setName,
                value: entry.id,
              }))}
              summary={practiceScopeLabel(sets, setIds)}
              value={setIds}
            />
          </ListSection>
          {[
            {
              title: t("practice.wordReview"),
              formats: availableFormats.filter((task) => isWordTask(task)),
            },
            {
              title: t("practice.examFormats"),
              formats: availableFormats.filter((task) => !isWordTask(task)),
            },
          ]
            .filter((group) => group.formats.length > 0)
            .map((group) => (
              <ListSection
                key={group.title}
                header={group.title}
                footer={
                  group.formats.some(isWordTask) &&
                  hasWords &&
                  counts.meaning === 0
                    ? t("practice.meaningPoolHint")
                    : undefined
                }
              >
                {group.formats.map((task) => (
                  <ListSwitchRow
                    key={task}
                    checked={tasks.includes(task)}
                    detail={`${practiceTaskHint(task)} · ${t("practice.formatReady", { count: counts[task] })}`}
                    icon={
                      task !== "meaning" &&
                      task !== "reverse" &&
                      isPassageKind(task)
                        ? Icons.reading
                        : Icons.question
                    }
                    label={practiceTaskLabel(task)}
                    onCheckedChange={(checked) =>
                      onTasksChange(
                        PRACTICE_TASKS.filter((entry) =>
                          entry === task ? checked : tasks.includes(entry),
                        ),
                      )
                    }
                  />
                ))}
              </ListSection>
            ))}
          <ListSection footer={t("practice.oneSenseHint")}>
            {hasExam && (
              <ListPicker
                label={t("practice.difficulty")}
                onChange={(value) =>
                  onDifficultyChange(value as WorkspaceQuestionDifficulty)
                }
                options={difficultyOptions(t("practice.allDifficulties"))}
                value={String(difficulty)}
              />
            )}
            <ListSwitchRow
              checked={oneSensePerWord}
              label={t("practice.oneSensePerWord")}
              onCheckedChange={onOneSenseChange}
            />
          </ListSection>
          {presets ? (
            <section className="grid gap-2.5">
              <div className="flex items-baseline justify-between gap-3 px-1">
                <h2 className="type-section">{t("practice.amount")}</h2>
                <span className="type-hint tabular-nums text-muted-foreground">
                  {t("practice.readyQuestions", {
                    count: availableQuestionCount,
                  })}
                </span>
              </div>
              <LiquidTabs
                ariaLabel={t("practice.amount")}
                className="w-full [&_.t-tabs]:flex [&_.t-tabs]:w-full [&_.t-tab]:flex-1"
                options={[
                  ...presets.map((value) => ({
                    value: String(value),
                    label: String(value),
                  })),
                  { value: "custom", label: t("practice.customAmount") },
                ]}
                value={custom ? "custom" : String(amount)}
                onValueChange={(value) => {
                  if (value === "custom") return setCustom(true);
                  setCustom(false);
                  onAmountChange(Number(value));
                }}
              />
              {custom && (
                <div className="rounded-[var(--radius-card)] bg-card px-5 py-3">
                  <p className="text-center text-[2rem] font-extrabold tabular-nums">
                    {t("practice.amountValue", { count: shownAmount })}
                  </p>
                  <input
                    aria-label={t("practice.amount")}
                    className="practice-amount-slider"
                    disabled={sliderMax < 2}
                    max={Math.max(1, sliderMax)}
                    min={1}
                    onChange={(event) =>
                      onAmountChange(Number(event.target.value))
                    }
                    type="range"
                    value={shownAmount}
                  />
                  <div className="flex justify-between text-xs tabular-nums text-muted-foreground">
                    <span>1</span>
                    <span>{Math.max(1, sliderMax)}</span>
                  </div>
                </div>
              )}
            </section>
          ) : (
            availableQuestionCount > 0 && (
              <ListSection>
                {slider}
                {extraScope}
              </ListSection>
            )
          )}
        </div>
      )}
    </StepFrame>
  );
}

const AMOUNT_PRESETS = [10, 20, 30, 50];

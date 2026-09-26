"use client";

import type {
  LibrarySet,
  PracticeCardTask,
  PracticeTask,
  PracticeTrack,
  WorkspaceQuestionDifficulty,
} from "@/types";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { BackControl } from "@/components/ui/back-control";
import { ChoiceChecklist } from "@/components/ui/choice-checklist";
import { ChoiceList } from "@/components/ui/choice-list";
import { DraftSaveStatus } from "@/components/ui/draft-save-status";
import { Icons } from "@/components/ui/icons";
import { EmptyState } from "@/components/ui/page-state";
import {
  ListChoiceGroup,
  ListPicker,
  ListSection,
  ListSwitchRow,
} from "@/components/ui/list";
import { StepFrame, StepRecap } from "@/components/ui/step-frame";
import { PRACTICE_CARD_TASKS, PRACTICE_QUESTION_TASKS } from "@/constants";
import { t } from "@/lib/i18n";
import type { DraftPersistence } from "@/lib/draft-persistence";
import { LIBRARY_QUESTIONS_HREF } from "@/lib/routes";
import { practiceTaskHint, practiceTaskLabel } from "@/lib/practice-tasks";
import { difficultyOptions } from "@/lib/question-options";
import { isPassageKind } from "@/src/lib/question-formats";

/** 隨機混合 is both card tasks at once, so it needs no separate stored value. */
const CARD_STYLES = ["flashcard", "spelling", "mixed"] as const;
type CardStyle = (typeof CARD_STYLES)[number];

function styleOfTasks(tasks: PracticeTask[]): CardStyle {
  const chosen = PRACTICE_CARD_TASKS.filter((task) => tasks.includes(task));
  if (chosen.length > 1) return "mixed";
  return (chosen[0] ?? "flashcard") as CardStyle;
}

function tasksOfStyle(style: CardStyle): PracticeCardTask[] {
  return style === "mixed" ? [...PRACTICE_CARD_TASKS] : [style];
}

/**
 * Starting a session is a short questionnaire, one question per screen.
 *
 * Choose a track, then set its range and start. Formats stay on the same screen
 * as the question count, with all available formats chosen by default.
 */
export function PracticeSetup({
  amount,
  availableQuestionCount,
  backHref,
  cardCount,
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
  onTrackChange,
  queueLength,
  setId,
  sets,
  tasks,
  track,
  trackPreset,
}: {
  amount: number;
  availableQuestionCount: number;
  backHref: string;
  /** Everything FSRS has scheduled in range, however it ends up being asked. */
  cardCount: number;
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
  onTrackChange: (track: PracticeTrack | null) => void;
  queueLength: number;
  setId: string;
  sets: LibrarySet[];
  tasks: PracticeTask[];
  track: PracticeTrack | null;
  /** The track arrived in the link, so the branch step is already answered. */
  trackPreset?: PracticeTrack;
}) {
  const questionCount = PRACTICE_QUESTION_TASKS.reduce(
    (total, task) => total + counts[task],
    0,
  );
  // A format nothing in range was written in is not a choice, so it is not
  // offered; the range step above is what changes this list.
  const availableFormats = PRACTICE_QUESTION_TASKS.filter(
    (task) => counts[task] > 0,
  );

  const total = trackPreset ? 1 : 2;
  const current = total;
  const draftStatus = <DraftSaveStatus status={draftPersistence} />;

  if (!track) {
    return (
      <StepFrame
        back={<BackControl href={backHref} />}
        current={1}
        status={draftStatus}
        title={t("practice.chooseTitle")}
        total={total}
      >
        <ChoiceList
          onSelect={(value) => {
            const chosen = value as PracticeTrack;
            onTrackChange(chosen);
            onTasksChange(
              chosen === "fsrs"
                ? tasksOfStyle(styleOfTasks(tasks))
                : PRACTICE_QUESTION_TASKS.filter((task) => counts[task] > 0),
            );
          }}
          options={[
            {
              description: t("practice.reviewSummary"),
              icon: Icons.review,
              label: t("practice.review"),
              meta: cardCount
                ? t("practice.reviewReady", { count: cardCount })
                : t("practice.reviewNone"),
              metaEmpty: !cardCount,
              value: "fsrs",
            },
            {
              description: t("practice.questionsSummary"),
              icon: Icons.practice,
              label: t("practice.questions"),
              meta: questionCount
                ? t("practice.questionsReady", { count: questionCount })
                : t("practice.questionsNone"),
              metaEmpty: !questionCount,
              value: "questions",
            },
          ]}
        />
      </StepFrame>
    );
  }

  const fsrs = track === "fsrs";
  const availableCount = fsrs ? cardCount : availableQuestionCount;
  const shownAmount = Math.min(amount, Math.max(1, availableCount));
  const empty = fsrs ? !cardCount : !questionCount;
  const needsContent = fsrs ? !hasWords : !hasQuestionContent;
  const emptyHref = !hasWords
    ? "/app/sets/new"
    : fsrs
      ? "/app/library"
      : "/app/questions/generate";
  const EmptyIcon = !hasWords
    ? Icons.create
    : fsrs
      ? Icons.library
      : Icons.generate;
  const emptyLabel = !hasWords
    ? t("practice.addWordsFirst")
    : fsrs
      ? t("home.openLibrary")
      : t("practice.generateFirst");

  const recap = (
    <StepRecap
      items={[
        availableCount
          ? t(fsrs ? "practice.readyReview" : "practice.readyQuestions", {
              count: availableCount,
            })
          : t("practice.noContent"),
      ]}
      onEdit={trackPreset ? undefined : () => onTrackChange(null)}
    />
  );

  const emptyFooter = (
    <Button asChild className="w-full" size="lg">
      <Link href={emptyHref}>
        <EmptyIcon />
        {emptyLabel}
      </Link>
    </Button>
  );

  const beginFooter = (
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
      {!fsrs && (
        <p className="mt-4 text-center">
          <Link
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            href={LIBRARY_QUESTIONS_HREF}
          >
            {t("practice.manageQuestions")}
          </Link>
        </p>
      )}
    </>
  );

  return (
    <StepFrame
      back={<BackControl href={backHref} />}
      current={current}
      status={draftStatus}
      footer={needsContent || (fsrs && empty) ? emptyFooter : beginFooter}
      onBack={trackPreset ? undefined : () => onTrackChange(null)}
      recap={needsContent ? undefined : recap}
      title={t("practice.scopeTitle")}
      total={total}
    >
      {needsContent && (
        <EmptyState
          variant="filtered"
          title={t("practice.noContent")}
          description={t(
            fsrs || !hasWords ? "practice.addWordsHint" : "practice.generateHint",
          )}
        />
      )}
      {!needsContent && (
        <div className="space-y-7">
          <ListSection header={t("practice.scopeHeader")}>
            <ListPicker
              label={t("practice.set")}
              onChange={(value) => {
                onSetChange(value === "all" ? "" : value);
                if (!fsrs) onTasksChange([...PRACTICE_QUESTION_TASKS]);
              }}
              options={[
                { label: t("practice.allSets"), value: "all" },
                ...sets.map((entry) => ({
                  label: entry.setName,
                  value: entry.id,
                })),
              ]}
              value={setId || "all"}
            />
            {availableCount > 0 && (
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
                  max={availableCount}
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
                    {t("practice.amountMax", { count: availableCount })}
                  </span>
                </div>
              </div>
            )}
          </ListSection>

          {fsrs && (
            <ListSection
              footer={t("practice.cardStyleHint")}
              header={t("practice.cardStyleTitle")}
            >
              <ListChoiceGroup
                label={t("practice.cardStyleTitle")}
                onSelect={(style) => onTasksChange(tasksOfStyle(style))}
                value={styleOfTasks(tasks)}
                options={CARD_STYLES.map((style) => ({
                  id: style,
                  detail:
                    style === "mixed"
                      ? t("practice.cardStyleMixedHint")
                      : practiceTaskHint(style),
                  label:
                    style === "mixed"
                      ? t("practice.cardStyleMixed")
                      : practiceTaskLabel(style),
                }))}
              />
              <ListSwitchRow
                checked={leechOnly}
                detail={t("practice.leechOnlyHint")}
                label={t("practice.leechOnly")}
                onCheckedChange={onLeechOnlyChange}
              />
            </ListSection>
          )}
          {!fsrs && (
            <ListSection>
              <ListSwitchRow
                checked={oneSensePerWord}
                detail={t("practice.oneSenseHint")}
                label={t("practice.oneSensePerWord")}
                onCheckedChange={onOneSenseChange}
              />
            </ListSection>
          )}
          {!fsrs && availableFormats.length > 0 && (
            <section>
              <h2 className="type-list-header mb-2 px-1">
                {t("practice.formatsTitle")}
              </h2>
              <ChoiceChecklist
                onToggle={(value, checked) =>
                  onTasksChange(
                    PRACTICE_QUESTION_TASKS.filter((entry) =>
                      entry === value ? checked : tasks.includes(entry),
                    ),
                  )
                }
                options={availableFormats.map((task) => ({
                  description: practiceTaskHint(task),
                  icon: isPassageKind(task) ? Icons.reading : Icons.question,
                  label: practiceTaskLabel(task),
                  meta: t("practice.formatReady", { count: counts[task] }),
                  value: task,
                }))}
                selected={tasks}
              />
            </section>
          )}
          {!fsrs && (
            <ListSection>
              <ListPicker
                label={t("practice.difficulty")}
                onChange={(value) => {
                  onDifficultyChange(value as WorkspaceQuestionDifficulty);
                  onTasksChange([...PRACTICE_QUESTION_TASKS]);
                }}
                options={difficultyOptions(t("practice.allDifficulties"))}
                value={String(difficulty)}
              />
            </ListSection>
          )}
        </div>
      )}
    </StepFrame>
  );
}

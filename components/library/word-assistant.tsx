"use client";
import type { WordDraft } from "@/types";
import { useMemo, useState } from "react";
import { AiRunPanel } from "@/components/ai/ai-run-panel";
import {
  useAiGeneration,
  useReviewHandoff,
  type AiGenerationSnapshot,
} from "@/components/ai/use-ai-generation";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { StepActions } from "@/components/ui/step-actions";
import { t } from "@/lib/i18n";
import { wordTask } from "@/src/lib/ai/tasks";
import { WordPreview } from "@/components/library/word-preview";
import {
  buildWordGenerationSources,
  mergeWordDrafts,
} from "@/src/lib/word-generation";

export type AssistantPhase = "run" | "review";

export interface AssistedWordRow {
  examples: string[];
  meaningZh: string;
  pos: string;
  supplementary: boolean;
  word: string;
}
function toRows(drafts: WordDraft[]): AssistedWordRow[] {
  return drafts.flatMap((draft) =>
    draft.senses.map((sense) => ({
      examples: sense.examples,
      meaningZh: sense.meaning,
      pos: sense.pos,
      supplementary: sense.supplementary,
      word: draft.word,
    })),
  );
}

/**
 * Generating a word list, then reading it.
 *
 * The run and its output are two steps, because they are two different jobs:
 * one is a decision about how much to spend and a progress bar, the other is
 * forty-two words that have to be read at a comfortable size. The phase is the
 * caller's, so the page around it can say which step this is and where back
 * goes.
 */
export function WordAssistant({
  initialRun,
  onApply,
  onPhase,
  onRunChange,
  phase,
  sources: raw,
}: {
  initialRun?: AiGenerationSnapshot<WordDraft>;
  onApply: (rows: AssistedWordRow[]) => void | Promise<void>;
  onPhase: (phase: AssistantPhase) => void;
  onRunChange?: (snapshot: AiGenerationSnapshot<WordDraft>) => void;
  phase: AssistantPhase;
  sources: string;
}) {
  const [applying, setApplying] = useState(false);
  const [saveError, setSaveError] = useState("");
  const sources = useMemo(() => buildWordGenerationSources(raw), [raw]);
  const generation = useAiGeneration<WordDraft>({
    initialSnapshot: initialRun,
    merge: mergeWordDrafts,
    onSnapshotChange: onRunChange,
  });
  const { state } = generation;
  const task = useMemo(() => wordTask(sources), [sources]);
  useReviewHandoff(state.status, () => onPhase("review"));
  const running = state.status === "running";

  if (phase === "review")
    return (
      <fieldset disabled={applying} className="min-w-0 space-y-7">
        <ul className="space-y-3">
          {state.items.map((word) => (
            <li
              key={word.word}
              className="rounded-xl bg-[var(--surface-inset)] p-3.5"
            >
              <WordPreview
                word={word}
                disabled={applying}
                onSave={(draft) =>
                  generation.setItems(
                    state.items.map((entry) =>
                      entry === word ? draft : entry,
                    ),
                  )
                }
              />
            </li>
          ))}
        </ul>

        <p className="type-hint">{t("ai.applyHint")}</p>
        <StepActions width="wide">
          {saveError && (
            <p role="alert" className="text-sm text-destructive">
              {saveError}
            </p>
          )}
          <Button
            className="w-full"
            disabled={applying || !state.items.length}
            onClick={async () => {
              setApplying(true);
              setSaveError("");
              try {
                await onApply(toRows(state.items));
              } catch (reason) {
                setSaveError(
                  t("ai.applyFailed", {
                    message: reason instanceof Error ? reason.message : String(reason),
                  }),
                );
              } finally {
                setApplying(false);
              }
            }}
            size="lg"
            type="button"
          >
            <Icons.success />
            {t("ai.applyWords")}
          </Button>
          <Button
            disabled={applying}
            onClick={() => onPhase("run")}
            type="button"
            variant="ghost"
          >
            <Icons.back />
            {t("ai.reviewBack")}
          </Button>
        </StepActions>
      </fieldset>
    );

  return (
    <AiRunPanel
      actionLabel={t("managed.confirmGenerate")}
      billableCount={task.billableCount}
      configured={generation.configured}
      kind={task.kind}
      onCancel={generation.cancel}
      onResume={generation.resume}
      onReview={
        state.items.length && !running ? () => onPhase("review") : undefined
      }
      onStart={() => generation.start(task)}
      onTierChange={generation.setTier}
      ready={generation.ready}
      state={state}
      tier={generation.tier}
      unit={t("ai.wordsUnit")}
    />
  );
}

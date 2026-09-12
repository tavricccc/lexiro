"use client";
import type { WordDraft } from "@/types";
import { useEffect, useMemo, useState } from "react";
import { AiRunPanel } from "@/components/ai/ai-run-panel";
import { useAiGeneration } from "@/components/ai/use-ai-generation";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { t } from "@/lib/i18n";
import { wordTask } from "@/src/lib/ai/tasks";
import { WordPreview } from "@/components/library/word-preview";
import { InputOrganizer } from "@/components/library/input-organizer";
import {
  buildWordGenerationSources,
  mergeWordDrafts,
} from "@/src/lib/word-generation";

export interface AssistedWordRow {
  examples: string[];
  meaningZh: string;
  pos: string;
  word: string;
}
function toRows(drafts: WordDraft[]): AssistedWordRow[] {
  return drafts.flatMap((draft) =>
    draft.senses.map((sense) => ({
      examples: sense.examples,
      meaningZh: sense.meaning,
      pos: sense.pos,
      word: draft.word,
    })),
  );
}
export function WordAssistant({
  onApply,
}: {
  onApply: (rows: AssistedWordRow[]) => void | Promise<void>;
}) {
  const [raw, setRaw] = useState("");
  const [applying, setApplying] = useState(false);
  const sources = useMemo(() => buildWordGenerationSources(raw), [raw]);
  const generation = useAiGeneration<WordDraft>({ merge: mergeWordDrafts });
  const { state, reset } = generation;
  const size = generation.batchSize;
  const task = useMemo(
    () => wordTask(raw, sources, size),
    [raw, sources, size],
  );
  useEffect(() => {
    reset();
  }, [raw, reset]);
  const running = state.status === "running";
  return (
    <section>
      <fieldset disabled={applying} className="min-w-0">
        <InputOrganizer
          onConfirm={setRaw}
          onInvalidate={() => setRaw("")}
          disabled={running || applying}
        />
        {raw && (
          <div className="mt-4">
            <AiRunPanel
              actionLabel={t("managed.confirmGenerate")}
              configured={generation.configured}
              ready={generation.ready}
              onCancel={generation.cancel}
              onResume={generation.resume}
              onStart={() => generation.start(task)}
              kind={task.kind}
              billableCount={task.billableCount}
              tier={generation.tier}
              onTierChange={generation.setTier}
              scopeSummary={t("setEditor.wordsFound", {
                count: sources.length,
              })}
              state={state}
              unit={t("ai.wordsUnit")}
              results={
                state.items.length > 0 ? (
                  <>
                    <div className="mb-4 flex flex-wrap items-center gap-3">
                      <Button
                        type="button"
                        disabled={running || applying}
                        onClick={async () => {
                          setApplying(true);
                          try {
                            await onApply(toRows(state.items));
                          } finally {
                            setApplying(false);
                          }
                        }}
                      >
                        <Icons.success />
                        {t("ai.applyWords")}
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        {t("ai.applyHint")}
                      </p>
                    </div>
                    <ul className="max-h-80 space-y-3 overflow-y-auto overscroll-contain pr-1">
                      {state.items.map((word) => (
                        <li
                          key={word.word}
                          className="rounded-xl bg-[var(--surface-inset)] p-3.5"
                        >
                          <WordPreview
                            word={word}
                            disabled={running || applying}
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
                  </>
                ) : undefined
              }
            />
          </div>
        )}
      </fieldset>
    </section>
  );
}

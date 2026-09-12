"use client";
import type { WordDraft } from "@/types";
import { useEffect, useMemo, useState } from "react";
import { AiRunPanel } from "@/components/ai/ai-run-panel";
import { useAiGeneration } from "@/components/ai/use-ai-generation";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { t } from "@/lib/i18n";
import { buildImportPrompt } from "@/src/lib/importPrompt";
import { chunks, wordTask } from "@/src/lib/ai/tasks";
import {
  buildWordGenerationSources,
  mergeWordDrafts,
  parseWordGenerationJson,
} from "@/src/lib/word-generation";

export interface AssistedWordRow {
  example: string;
  meaningZh: string;
  pos: string;
  word: string;
}
function toRows(drafts: WordDraft[]): AssistedWordRow[] {
  return drafts.flatMap((draft) =>
    draft.senses.map((sense) => ({
      example: sense.examples.join("\n"),
      meaningZh: sense.meaning,
      pos: sense.pos,
      word: draft.word,
    })),
  );
}
export function WordAssistant({
  onApply,
}: {
  onApply: (rows: AssistedWordRow[]) => void;
}) {
  const [raw, setRaw] = useState(""),
    [examples, setExamples] = useState(false),
    [manualError, setManualError] = useState("");
  const sources = useMemo(() => buildWordGenerationSources(raw), [raw]);
  const generation = useAiGeneration<WordDraft>({ merge: mergeWordDrafts });
  const { state, reset } = generation;
  const size = generation.batchSize;
  const batches = useMemo(() => chunks(sources, size), [sources, size]);
  const task = useMemo(
    () => wordTask(raw, sources, examples, size),
    [raw, sources, examples, size],
  );
  const prompts = useMemo(
    () => batches.map((batch) => buildImportPrompt(raw, batch, examples)),
    [batches, examples, raw],
  );
  useEffect(() => {
    reset();
    setManualError("");
  }, [examples, raw, reset]);
  const applyManual = (response: string, index: number) => {
    try {
      generation.setItems(
        mergeWordDrafts([
          ...state.items,
          ...parseWordGenerationJson(response, batches[index], examples),
        ]),
        sources.length,
      );
      setManualError("");
      return true;
    } catch (reason) {
      setManualError(
        t("setEditor.invalidAiResponse", {
          message: reason instanceof Error ? reason.message : String(reason),
        }),
      );
      return false;
    }
  };
  const running = state.status === "running";
  return (
    <section>
      <Field
        label={t("setEditor.rawWords")}
        hint={
          sources.length
            ? t("setEditor.wordsFound", { count: sources.length })
            : undefined
        }
      >
        <Textarea
          className="min-h-28"
          placeholder={t("setEditor.rawWordsPlaceholder")}
          value={raw}
          disabled={running}
          onChange={(e) => setRaw(e.target.value)}
        />
      </Field>
      <label className="mt-3 flex cursor-pointer items-center gap-2.5 text-sm">
        <Checkbox
          checked={examples}
          disabled={running}
          onCheckedChange={(checked) => setExamples(checked === true)}
        />
        {t("setEditor.generateExamples")}
      </label>
      <div className="mt-4">
        <AiRunPanel
          actionLabel={t("setEditor.organizeWords")}
          configured={generation.configured}
          enabled={generation.enabled}
          ready={generation.ready}
          manualError={manualError}
          onCancel={generation.cancel}
          onManualResponse={applyManual}
          onResume={generation.resume}
          onStart={() => generation.start(task)}
          prompts={prompts}
          scopeSummary={t("setEditor.wordsFound", { count: sources.length })}
          state={state}
          unit={t("ai.wordsUnit")}
          results={
            state.items.length > 0 ? (
              <>
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    disabled={running}
                    onClick={() => onApply(toRows(state.items))}
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
                      <p className="font-semibold">{word.word}</p>
                      {word.senses.map((sense, index) => (
                        <div key={index} className="mt-1.5">
                          <p className="text-sm">
                            <span className="mr-2 text-xs text-muted-foreground">
                              {sense.pos}
                            </span>
                            {sense.meaning}
                          </p>
                          {sense.examples.map((example) => (
                            <p
                              key={example}
                              className="mt-1 text-xs leading-5 text-muted-foreground"
                            >
                              {example}
                            </p>
                          ))}
                        </div>
                      ))}
                    </li>
                  ))}
                </ul>
              </>
            ) : undefined
          }
        />
      </div>
    </section>
  );
}

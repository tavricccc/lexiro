"use client";

import type { WordDraft } from "@/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AiRunPanel } from "@/components/ai/ai-run-panel";
import { useAiGeneration } from "@/components/ai/use-ai-generation";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { t } from "@/lib/i18n";
import { generateWithSavedAi } from "@/src/lib/ai-provider";
import { buildImportPrompt } from "@/src/lib/importPrompt";
import {
  buildWordGenerationSources,
  mergeWordDrafts,
  parseWordGenerationJson,
  type WordGenerationSource,
} from "@/src/lib/word-generation";

export interface AssistedWordRow {
  example: string;
  meaningZh: string;
  pos: string;
  word: string;
}

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size)
    batches.push(items.slice(index, index + size));
  return batches;
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

/**
 * Turning a pasted list into senses is one press, not three.
 *
 * Whatever the AI returns is validated and then handed straight to the editor,
 * where every field is editable and nothing is saved until the user saves. The
 * preview that used to sit here asked the user to approve rows they could not
 * change, which is a confirmation that buys nothing: anything wrong with them
 * is fixed in the editor either way.
 */
export function WordAssistant({
  onApply,
}: {
  onApply: (rows: AssistedWordRow[]) => void;
}) {
  const [raw, setRaw] = useState("");
  const [examples, setExamples] = useState(false);
  const [manualError, setManualError] = useState("");
  const sources = useMemo(() => buildWordGenerationSources(raw), [raw]);

  const parseBatch = useCallback(
    (batch: WordGenerationSource[], response: string) =>
      parseWordGenerationJson(response, batch, examples),
    [examples],
  );

  const generation = useAiGeneration<WordGenerationSource[], WordDraft>({
    merge: mergeWordDrafts,
    run: async (batch, context) =>
      parseBatch(
        batch,
        await generateWithSavedAi(buildImportPrompt(raw, batch, examples), {
          onCharacters: context.onCharacters,
          signal: context.signal,
        }),
      ),
  });

  // Long lists are split into as many requests as the configured batch size
  // needs, instead of being refused. The size comes from the hook rather than a
  // synchronous read, which used to fall back to the default whenever this
  // screen rendered before stored settings had loaded.
  const batches = useMemo(
    () => chunk(sources, Math.max(1, generation.batchSize)),
    [generation.batchSize, sources],
  );
  const prompts = useMemo(
    () => batches.map((batch) => buildImportPrompt(raw, batch, examples)),
    [batches, examples, raw],
  );

  const { reset, setItems, state: run } = generation;

  useEffect(() => {
    reset();
    setManualError("");
  }, [examples, raw, reset]);

  const applyRef = useRef(onApply);
  applyRef.current = onApply;
  // Only a finished request hands itself over. The manual path sets items one
  // pasted batch at a time, and must not leave for the editor while the user
  // still has segments to paste.
  const requested = useRef(false);
  if (run.status === "running") requested.current = true;
  const settled = run.status === "done" || run.status === "partial";

  useEffect(() => {
    if (!settled || !requested.current || !run.items.length) return;
    requested.current = false;
    applyRef.current(toRows(run.items));
  }, [run.items, settled]);

  const applyManual = (response: string, batchIndex: number) => {
    setManualError("");
    try {
      const merged = mergeWordDrafts([
        ...run.items,
        ...parseBatch(batches[batchIndex], response),
      ]);
      setItems(merged);
      // The last segment is the whole answer, so it goes to the editor too.
      if (batchIndex === batches.length - 1) applyRef.current(toRows(merged));
    } catch (reason) {
      setManualError(
        t("setEditor.invalidAiResponse", {
          message: reason instanceof Error ? reason.message : String(reason),
        }),
      );
    }
  };

  return (
    <section>
      <Field
        label={t("setEditor.rawWords")}
        hint={
          sources.length ? t("setEditor.wordsFound", { count: sources.length }) : undefined
        }
      >
        <Textarea
          className="min-h-28"
          placeholder={t("setEditor.rawWordsPlaceholder")}
          value={raw}
          onChange={(event) => setRaw(event.target.value)}
        />
      </Field>

      <label className="mt-3 flex cursor-pointer items-center gap-2.5 text-sm">
        <Checkbox
          checked={examples}
          onCheckedChange={(checked) => setExamples(checked === true)}
        />
        {t("setEditor.generateExamples")}
      </label>

      <div className="mt-4">
        <AiRunPanel
          actionLabel={t("setEditor.organizeWords")}
          configured={generation.configured}
          manualError={manualError}
          onCancel={generation.cancel}
          onManualResponse={applyManual}
          onRetryFailed={generation.retryFailed}
          onStart={() => generation.start(batches)}
          prompts={prompts}
          scopeSummary={t("setEditor.wordsFound", { count: sources.length })}
          state={run}
        />
      </div>

    </section>
  );
}

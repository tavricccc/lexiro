"use client";

import type { WordDraft } from "@/types";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AiRunPanel } from "@/components/ai/ai-run-panel";
import { useAiGeneration } from "@/components/ai/use-ai-generation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Icons } from "@/components/ui/icons";
import { Textarea } from "@/components/ui/textarea";
import { t } from "@/lib/i18n";
import { loadAiSettings } from "@/src/lib/ai-provider";
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

export function WordAssistant({
  onApply,
}: {
  onApply: (rows: AssistedWordRow[]) => void;
}) {
  const [raw, setRaw] = useState("");
  const [examples, setExamples] = useState(false);
  const [manualError, setManualError] = useState("");
  const sources = useMemo(() => buildWordGenerationSources(raw), [raw]);

  // Long lists are split into as many requests as the configured batch size
  // needs, instead of being refused.
  const batches = useMemo(
    () => chunk(sources, Math.max(1, loadAiSettings().batchSize)),
    [sources],
  );
  const prompts = useMemo(
    () => batches.map((batch) => buildImportPrompt(raw, batch, examples)),
    [batches, examples, raw],
  );

  const parseBatch = useCallback(
    (batch: WordGenerationSource[], response: string) =>
      parseWordGenerationJson(response, batch, examples),
    [examples],
  );

  const generation = useAiGeneration<WordGenerationSource[], WordDraft>({
    merge: mergeWordDrafts,
    run: async (batch, signal) =>
      parseBatch(
        batch,
        await generateWithSavedAi(buildImportPrompt(raw, batch, examples), {
          signal,
        }),
      ),
  });

  const { reset, setItems, state: run } = generation;

  useEffect(() => {
    reset();
    setManualError("");
  }, [examples, raw, reset]);

  const applyManual = (response: string, batchIndex: number) => {
    setManualError("");
    try {
      setItems(
        mergeWordDrafts([...run.items, ...parseBatch(batches[batchIndex], response)]),
      );
    } catch (reason) {
      setManualError(
        t("setEditor.invalidAiResponse", {
          message: reason instanceof Error ? reason.message : String(reason),
        }),
      );
    }
  };

  const rows = toRows(run.items);

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

      {rows.length > 0 && (
        <div className="mt-4 border-t pt-4">
          <p className="text-sm font-medium">
            {t("ai.readyCount", { count: rows.length })}
          </p>
          <ul className="entry-senses mt-3 grid gap-1.5">
            {rows.slice(0, 8).map((row, index) => (
              <li
                className="flex items-baseline gap-2 text-sm"
                key={`${row.word}-${row.pos}-${index}`}
              >
                <span className="font-lexical font-medium">{row.word}</span>
                <span className="entry-pos text-xs">{row.pos}</span>
                <span className="truncate text-muted-foreground">
                  {row.meaningZh}
                </span>
              </li>
            ))}
          </ul>
          <Button
            className="mt-4"
            onClick={() => onApply(rows)}
            size="lg"
            type="button"
          >
            <Icons.success />
            {t("setEditor.applyPreview", { count: rows.length })}
          </Button>
        </div>
      )}
    </section>
  );
}

"use client";

import { useState } from "react";
import type { LibraryQuestion, WordEntry } from "@/types";
import { t } from "@/lib/i18n";
import { senseKey } from "@/src/lib/library";
import { QuestionPreview } from "./question-preview";
import { QuestionPager } from "./question-pager";

export function GeneratedQuestionResults({
  items,
  words,
  excludedIds = [],
  onToggle,
}: {
  items: LibraryQuestion[];
  words: WordEntry[];
  excludedIds?: string[];
  onToggle?: (id: string) => void;
}) {
  const [index, setIndex] = useState(0);
  const sources = new Map(
    words.flatMap((word) =>
      word.senses.map(
        (sense) =>
          [
            senseKey(word.wordKey, sense.id),
            { word: word.word, meaningZh: sense.meaningZh },
          ] as const,
      ),
    ),
  );
  if (!items.length) return null;
  const currentIndex = Math.min(index, items.length - 1);
  const question = items[currentIndex];
  const source =
    question.kind === "reading"
      ? null
      : sources.get(senseKey(question.wordKey, question.senseId));
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 rule-b pb-5">
        <div className="min-w-0 flex-1">
          <QuestionPager
            index={currentIndex}
            total={items.length}
            onChange={setIndex}
          />
          {question.kind !== "reading" && (
            <p className="mt-3 text-sm text-muted-foreground">
              {t("questions.targetWord", {
                word: source?.word ?? question.wordKey,
              })}
              {source?.meaningZh && ` · ${source.meaningZh}`}
            </p>
          )}
        </div>
        {onToggle && (
          <label className="flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-xl bg-card px-4 py-2 text-sm font-medium md:min-h-9">
            <input
              type="checkbox"
              checked={!excludedIds.includes(question.id)}
              className="size-4 accent-[var(--primary)]"
              onChange={() => onToggle(question.id)}
            />
            {t("questions.includeQuestion")}
          </label>
        )}
      </div>
      <QuestionPreview key={question.id} question={question} />
    </div>
  );
}

import type { LibraryQuestion, WordEntry } from "@/types";
import { t } from "@/lib/i18n";
import { senseKey } from "@/src/lib/library";
import { QuestionPreview } from "./question-preview";

export function GeneratedQuestionResults({
  items,
  words,
}: {
  items: LibraryQuestion[];
  words: WordEntry[];
}) {
  const sources = new Map(
    words.flatMap((word) =>
      word.senses.map((sense) => [
        senseKey(word.wordKey, sense.id),
        { word: word.word, meaningZh: sense.meaningZh },
      ] as const),
    ),
  );
  return (
    <ol className="mt-4 rule-card rule-list">
      {items.map((question) => {
        const source =
          question.kind === "reading"
            ? null
            : sources.get(senseKey(question.wordKey, question.senseId));
        return (
          <li className="py-[var(--row-padding-block)]" key={question.id}>
            {question.kind !== "reading" && (
              <p className="mb-2 text-sm font-medium">
                {t("questions.targetWord", {
                  word: source?.word ?? question.wordKey,
                })}
                {source?.meaningZh && ` · ${source.meaningZh}`}
              </p>
            )}
            <QuestionPreview question={question} />
          </li>
        );
      })}
    </ol>
  );
}

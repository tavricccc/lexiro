"use client";

import type { LibraryQuestion } from "@/types";
import { countEnglishWords } from "@lexiro/ai-contract";

import { PassageView } from "@/components/practice/passage-view";
import { t } from "@/lib/i18n";
import { questionFormatLabel } from "@/lib/question-options";
import { SENTENCE_BLANK } from "@/src/lib/question-formats";

/**
 * What a generated item will actually look like when it is practised.
 *
 * The generator promises a preview before anything is written to the question
 * bank, and for a passage format that promise is only kept by showing the
 * passage with its blanks cut and the shared bank laid out — a title alone tells
 * the learner nothing about whether the item is any good.
 */
export function QuestionPreview({ question }: { question: LibraryQuestion }) {
  if (question.kind !== "reading") {
    return (
      <div>
        <Header
          format={question.questionStyle}
          wordCount={countEnglishWords(
            question.prompt.replace(
              SENTENCE_BLANK,
              question.options[question.answerIndex],
            ),
          )}
        />
        <p className="mt-1.5 leading-7">{question.prompt}</p>
        <OptionList
          answerIndex={question.answerIndex}
          options={question.options}
        />
      </div>
    );
  }

  const completePassage = question.questions.reduce(
    (passage, child) =>
      child.blank === undefined
        ? passage
        : passage.replace(
            `__${child.blank}__`,
            child.options[child.answerIndex],
          ),
    question.passage,
  );

  return (
    <div>
      <Header
        format={question.format}
        passage
        wordCount={countEnglishWords(completePassage)}
      />
      <p className="mt-1.5 type-subsection">{question.title}</p>
      <div className="mt-2.5">
        <PassageView passage={question.passage} />
      </div>
      {question.optionBank ? (
        <>
          <OptionList
            answerIndex={-1}
            label={t("questions.optionBank")}
            options={question.optionBank}
          />
          <div className="mt-3">
            <p className="text-xs font-medium text-muted-foreground">
              {t("questions.answerKey")}
            </p>
            <ol className="mt-1.5 grid gap-1.5 text-sm">
              {question.questions.map((child) => (
                <li className="flex gap-3" key={child.id}>
                  <span className="shrink-0 text-muted-foreground">
                    {t("questions.blankLabel", { index: child.blank! })}
                  </span>
                  <span className="min-w-0 leading-6">
                    {String.fromCharCode(65 + child.answerIndex)} ·{" "}
                    {question.optionBank![child.answerIndex]}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </>
      ) : (
        <ol className="mt-3 grid gap-3">
          {question.questions.map((child) => (
            <li key={child.id}>
              <p className="text-sm leading-6">{child.prompt}</p>
              <OptionList
                answerIndex={child.answerIndex}
                options={child.options}
              />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Header({
  format,
  passage = false,
  wordCount,
}: {
  format: string;
  passage?: boolean;
  wordCount: number;
}) {
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      <span className="font-medium text-brand-600">
        {questionFormatLabel(format)}
      </span>
      <span className="text-muted-foreground">
        {t(
          passage ? "questions.passageWordCount" : "questions.promptWordCount",
          {
            count: wordCount,
          },
        )}
      </span>
    </p>
  );
}

function OptionList({
  answerIndex,
  label,
  options,
}: {
  answerIndex: number;
  label?: string;
  options: string[];
}) {
  return (
    <div className="mt-2">
      {label && <p className="mb-1.5 text-xs text-muted-foreground">{label}</p>}
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
        {options.map((option, index) => (
          <li
            className={
              index === answerIndex
                ? "font-medium text-brand-600"
                : "text-muted-foreground"
            }
            key={index}
          >
            <span className="mr-1.5 text-xs">
              {String.fromCharCode(65 + index)}
            </span>
            {option}
          </li>
        ))}
      </ul>
    </div>
  );
}

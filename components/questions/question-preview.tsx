"use client";

import type { LibraryQuestion } from "@/types";

import { PassageView } from "@/components/practice/passage-view";
import { t } from "@/lib/i18n";
import { questionFormatLabel } from "@/lib/question-options";

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
        <Header format={question.questionStyle} />
        <p className="mt-1.5 leading-7">{question.prompt}</p>
        <OptionList
          answerIndex={question.answerIndex}
          options={question.options}
        />
      </div>
    );
  }

  return (
    <div>
      <Header format={question.format} />
      <p className="mt-1.5 font-lexical text-lg font-medium">{question.title}</p>
      <div className="mt-2.5">
        <PassageView passage={question.passage} />
      </div>
      {question.optionBank ? (
        <OptionList
          answerIndex={-1}
          label={t("questions.optionBank")}
          options={question.optionBank}
        />
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

function Header({ format }: { format: string }) {
  return (
    <p className="text-xs font-medium text-brand-600">
      {questionFormatLabel(format)}
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
      {label && (
        <p className="mb-1.5 text-xs text-muted-foreground">{label}</p>
      )}
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
            <span className="mr-1.5 font-lexical text-xs">
              {String.fromCharCode(65 + index)}
            </span>
            {option}
          </li>
        ))}
      </ul>
    </div>
  );
}

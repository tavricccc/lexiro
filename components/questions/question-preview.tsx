"use client";

import { useId, useState } from "react";
import type { LibraryQuestion } from "@/types";
import { countEnglishWords } from "@lexiro/ai-contract";

import { PassageView } from "@/components/practice/passage-view";
import { Icons } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { questionFormatLabel } from "@/lib/question-options";
import { SENTENCE_BLANK } from "@/src/lib/question-formats";
import { QuestionPager } from "./question-pager";
import {
  QuestionWorkspace,
  type QuestionWorkspacePane,
} from "./question-workspace";

export function QuestionPreview({ question }: { question: LibraryQuestion }) {
  const [index, setIndex] = useState(0);
  const [pane, setPane] = useState<QuestionWorkspacePane>("passage");
  const activeBlankId = useId();

  if (question.kind !== "reading") {
    return (
      <section className="space-y-5">
        <Header
          format={question.questionStyle}
          wordCount={countEnglishWords(
            question.prompt.replace(
              SENTENCE_BLANK,
              question.options[question.answerIndex],
            ),
          )}
        />
        <p className="max-w-[65ch] text-base leading-8 sm:text-lg">
          {question.prompt}
        </p>
        <OptionList
          answerIndex={question.answerIndex}
          options={question.options}
        />
        <Explanation
          explanation={question.explanation}
          whyWrong={question.whyWrong}
        />
      </section>
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
  const child = question.questions[index];
  const locate = (at: number) => {
    setIndex(at);
    setPane("passage");
    requestAnimationFrame(() =>
      document
        .getElementById(activeBlankId)
        ?.scrollIntoView({ block: "center", behavior: "smooth" }),
    );
  };

  return (
    <QuestionWorkspace
      pane={pane}
      onPaneChange={setPane}
      passage={
        <div className="rounded-[var(--radius-card)] bg-card p-5 sm:p-6">
          <Header
            format={question.format}
            passage
            wordCount={countEnglishWords(completePassage)}
          />
          <h2 className="mt-4 text-xl font-semibold leading-8">
            {question.title}
          </h2>
          <div className="mt-5 max-w-[68ch]">
            <PassageView
              passage={question.passage}
              activeBlank={child.blank}
              activeBlankId={activeBlankId}
            />
          </div>
          <Explanation explanation={question.explanation} />
        </div>
      }
      questions={
        <div className="space-y-5">
          <QuestionPager
            index={index}
            total={question.questions.length}
            blanks={question.format !== "reading"}
            onChange={setIndex}
          />
          {child.blank ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => locate(index)}
            >
              <Icons.search />
              {t("questions.locateBlank", { index: child.blank })}
            </Button>
          ) : (
            <h3 className="text-base font-semibold leading-7">
              {child.prompt}
            </h3>
          )}
          <OptionList
            answerIndex={child.answerIndex}
            label={question.optionBank ? t("questions.optionBank") : undefined}
            options={child.options}
          />
          <Explanation
            explanation={child.explanation}
            whyWrong={child.whyWrong}
          />
          {question.optionBank && (
            <details className="rule-t pt-3">
              <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium md:min-h-9">
                {t("questions.answerKey")}
              </summary>
              <ol className="mt-2 grid gap-1">
                {question.questions.map((item, at) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="flex min-h-11 w-full items-start gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 md:min-h-9"
                      onClick={() => locate(at)}
                    >
                      <span className="shrink-0 text-muted-foreground">
                        {t("questions.blankLabel", { index: item.blank! })}
                      </span>
                      <span className="min-w-0 leading-6">
                        {String.fromCharCode(65 + item.answerIndex)} ·{" "}
                        {item.options[item.answerIndex]}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </details>
          )}
        </div>
      }
    />
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
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <span className="font-medium text-primary">
        {questionFormatLabel(format)}
      </span>
      <span className="text-muted-foreground">
        {t(
          passage ? "questions.passageWordCount" : "questions.promptWordCount",
          { count: wordCount },
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
    <div>
      {label && <h3 className="mb-3 text-sm font-medium">{label}</h3>}
      <ol className="grid gap-2">
        {options.map((option, index) => (
          <li
            className={
              index === answerIndex
                ? "flex items-start gap-3 rounded-xl bg-primary/10 px-4 py-3 text-foreground"
                : "flex items-start gap-3 rounded-xl bg-card px-4 py-3 text-foreground"
            }
            key={index}
          >
            <span
              className={
                index === answerIndex
                  ? "grid size-7 shrink-0 place-items-center rounded-lg bg-primary text-sm font-medium text-primary-foreground"
                  : "grid size-7 shrink-0 place-items-center rounded-lg bg-muted text-sm font-medium text-muted-foreground"
              }
            >
              {String.fromCharCode(65 + index)}
            </span>
            <span className="min-w-0 flex-1 text-base leading-7">{option}</span>
            {index === answerIndex && (
              <Icons.success
                className="mt-1 size-5 shrink-0 text-primary"
                aria-label={t("questions.correctOption")}
              />
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function Explanation({
  explanation,
  whyWrong,
}: {
  explanation?: string;
  whyWrong?: Record<string, string>;
}) {
  if (!explanation && !whyWrong) return null;
  return (
    <section className="mt-5 space-y-3 rule-t pt-5">
      <h3 className="text-sm font-semibold">{t("questions.explanation")}</h3>
      {explanation && (
        <p className="whitespace-pre-line text-base leading-7">{explanation}</p>
      )}
      {whyWrong && (
        <dl className="grid gap-3 text-sm">
          {Object.entries(whyWrong).map(([option, reason]) => (
            <div className="flex gap-3" key={option}>
              <dt className="shrink-0 font-medium">{option}</dt>
              <dd className="min-w-0 leading-6 text-muted-foreground">
                {reason}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

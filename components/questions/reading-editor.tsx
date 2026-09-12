"use client";

import type { ReadingPack } from "@/types";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AnswerOptions } from "@/components/questions/answer-options";
import { BackControl } from "@/components/ui/back-control";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Icons } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { SelectField } from "@/components/ui/select-field";
import { Textarea } from "@/components/ui/textarea";
import { t } from "@/lib/i18n";
import { LIBRARY_QUESTIONS_HREF } from "@/lib/routes";
import { randomUUID } from "@/src/lib/id";
import { parseSenseKey, senseKey } from "@/src/lib/library";
import { difficultyOptions } from "@/lib/question-options";
import { useLibraryStore } from "@/stores/library-store";

interface ChildDraft {
  answerIndex: number;
  id?: string;
  options: string[];
  prompt: string;
  source: string;
}

interface ChildErrors {
  options?: string;
  prompt?: string;
  source?: string;
}

const emptyChild = (): ChildDraft => ({
  answerIndex: 0,
  options: ["", "", "", ""],
  prompt: "",
  source: "",
});

export function ReadingEditor({ readingId }: { readingId: string }) {
  const router = useRouter();
  const { state, saveQuestion } = useLibraryStore();
  const senses = useMemo(
    () =>
      Object.values(state.words).flatMap((word) =>
        word.senses.map((sense) => ({
          label: `${word.word} · ${sense.meaningZh}`,
          value: senseKey(word.wordKey, sense.id),
        })),
      ),
    [state.words],
  );

  const [title, setTitle] = useState("");
  const [passage, setPassage] = useState("");
  const [difficulty, setDifficulty] = useState<1 | 2 | 3>(2);
  const [children, setChildren] = useState<ChildDraft[]>([
    emptyChild(),
    emptyChild(),
    emptyChild(),
  ]);
  // Validation stays quiet until the first submit, so a half-filled form is
  // not already shouting at someone who has just started typing.
  const [submitted, setSubmitted] = useState(false);
  const [saveError, setSaveError] = useState("");

  const current = readingId
    ? state.questions.find(
        (question) => question.id === readingId && question.kind === "reading",
      )
    : undefined;

  useEffect(() => {
    if (!current || current.kind !== "reading") return;
    setTitle(current.title);
    setPassage(current.passage);
    setDifficulty(current.difficulty);
    setChildren(
      current.questions.map((child) => ({
        answerIndex: child.answerIndex,
        id: child.id,
        options: [...child.options],
        prompt: child.prompt,
        source: senseKey(child.wordKey, child.senseId),
      })),
    );
  }, [current]);

  const update = (index: number, value: Partial<ChildDraft>) =>
    setChildren((items) =>
      items.map((item, at) => (at === index ? { ...item, ...value } : item)),
    );

  const childErrors: ChildErrors[] = children.map((child) => ({
    options: child.options.some((option) => !option.trim())
      ? t("questions.optionsRequired")
      : undefined,
    prompt: child.prompt.trim() ? undefined : t("setEditor.required"),
    source: child.source ? undefined : t("questions.senseRequired"),
  }));
  const titleError = title.trim() ? undefined : t("setEditor.required");
  const passageError = passage.trim() ? undefined : t("setEditor.required");
  const valid =
    !titleError &&
    !passageError &&
    childErrors.every((errors) => !errors.options && !errors.prompt && !errors.source);

  const submit = async () => {
    setSubmitted(true);
    setSaveError("");
    if (!valid) return;
    const timestamp = new Date().toISOString();
    const sources = children.map((child) => parseSenseKey(child.source, state.words));
    if (sources.some((source) => !source)) {
      setSaveError(t("questions.unknownSense"));
      return;
    }
    const questions = children.map((child, index) => {
      const { senseId, wordKey } = sources[index]!;
      return {
        answerIndex: child.answerIndex,
        id: child.id ?? randomUUID(),
        kind: "multipleChoice" as const,
        options: child.options.map((option) => option.trim()),
        prompt: child.prompt.trim(),
        senseId,
        wordKey,
      };
    });
    const pack: ReadingPack = {
      createdAt: current?.createdAt ?? timestamp,
      difficulty,
      fingerprint: current?.fingerprint ?? "pending",
      format: "reading",
      id: current?.id ?? randomUUID(),
      kind: "reading",
      passage,
      questions,
      title,
      updatedAt: timestamp,
      wordKeys: [...new Set(questions.map((child) => child.wordKey))],
    };
    try {
      const result = await saveQuestion(pack);
      if (result === "duplicate") {
        setSaveError(t("questions.duplicate"));
        return;
      }
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : String(reason));
      return;
    }
    router.push(LIBRARY_QUESTIONS_HREF);
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        back={<BackControl href={LIBRARY_QUESTIONS_HREF} />}
        title={t("questions.editReading")}
      />

      <div className="grid gap-4">
        <Field
          error={submitted && titleError}
          label={t("questions.readingTitle")}
        >
          <Input
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t("questions.readingTitle")}
            value={title}
          />
        </Field>
        <Field error={submitted && passageError} label={t("questions.passage")}>
          <Textarea
            className="min-h-52 text-[1.0625rem] leading-[1.75]"
            onChange={(event) => setPassage(event.target.value)}
            placeholder={t("questions.passage")}
            value={passage}
          />
        </Field>
        <SelectField
          className="sm:max-w-56"
          label={t("practice.difficulty")}
          onValueChange={(value) => setDifficulty(Number(value) as 1 | 2 | 3)}
          options={difficultyOptions()}
          value={String(difficulty)}
        />
      </div>

      <div className="section-gap rule-card rule-list">
        {children.map((child, index) => (
          <section className="py-6" key={child.id ?? index}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="type-subsection">
                {t("questions.childPrompt", { index: index + 1 })}
              </h2>
              {children.length > 1 && (
                <Button
                  aria-label={t("questions.removeChild", { index: index + 1 })}
                  onClick={() =>
                    setChildren((items) => items.filter((_, at) => at !== index))
                  }
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <Icons.delete />
                </Button>
              )}
            </div>

            <div className="mt-4 grid gap-4">
              <SelectField
                description={t("questions.linkedSense")}
                onValueChange={(value) => update(index, { source: value })}
                options={senses}
                placeholder={t("questions.selectSense")}
                value={child.source}
              />
              {submitted && childErrors[index].source && (
                <p className="-mt-2 text-xs text-destructive" role="alert">
                  {childErrors[index].source}
                </p>
              )}
              <Field
                error={submitted && childErrors[index].prompt}
                label={t("questions.prompt")}
              >
                <Input
                  onChange={(event) =>
                    update(index, { prompt: event.target.value })
                  }
                  placeholder={t("questions.prompt")}
                  value={child.prompt}
                />
              </Field>
              <AnswerOptions
                answerIndex={child.answerIndex}
                error={submitted && childErrors[index].options}
                labelPrefix={`${t("questions.childPrompt", { index: index + 1 })} · `}
                name={`reading-answer-${index}`}
                onAnswerChange={(answerIndex) => update(index, { answerIndex })}
                onOptionChange={(optionIndex, value) =>
                  update(index, {
                    options: child.options.map((option, at) =>
                      at === optionIndex ? value : option,
                    ),
                  })
                }
                options={child.options}
              />
            </div>
          </section>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Button
          onClick={() => setChildren((items) => [...items, emptyChild()])}
          size="sm"
          type="button"
          variant="secondary"
        >
          <Icons.create />
          {t("questions.addChild")}
        </Button>
        <Button onClick={() => void submit()} size="lg" type="button">
          <Icons.success />
          {t("questions.save")}
        </Button>
      </div>
      {(saveError || (submitted && !valid)) && (
        <p className="mt-3 text-right text-xs text-destructive" role="alert">
          {saveError || t("questions.fixErrors")}
        </p>
      )}
    </div>
  );
}

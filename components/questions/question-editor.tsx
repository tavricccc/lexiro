"use client";

import type { LibraryQuestion, MultipleChoiceQuestion, QuestionStyle } from "@/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";

import { AnswerOptions } from "@/components/questions/answer-options";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Icons } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { SelectField } from "@/components/ui/select-field";
import { Textarea } from "@/components/ui/textarea";
import { t } from "@/lib/i18n";
import { randomUUID } from "@/src/lib/id";
import { parseSenseKey, senseKey } from "@/src/lib/library";
import { difficultyOptions, sentenceStyleOptions } from "@/lib/question-options";
import { useLibraryStore } from "@/stores/library-store";

interface Values {
  answerIndex: number;
  difficulty: 1 | 2 | 3;
  explanation: string;
  options: string[];
  prompt: string;
  questionStyle: QuestionStyle;
  source: string;
}

export function QuestionEditor({ questionId }: { questionId?: string }) {
  const router = useRouter();
  const { state, saveQuestion } = useLibraryStore();
  const current = questionId
    ? state.questions.find((entry) => entry.id === questionId)
    : undefined;
  const senses = useMemo(
    () =>
      Object.values(state.words).flatMap((word) =>
        word.senses.map((sense) => ({
          label: `${word.word} · ${sense.pos} ${sense.meaningZh}`,
          value: senseKey(word.wordKey, sense.id),
        })),
      ),
    [state.words],
  );
  const form = useForm<Values>({
    defaultValues: {
      answerIndex: 0,
      difficulty: 1,
      explanation: "",
      options: ["", "", "", ""],
      prompt: "",
      questionStyle: "vocabulary",
      source: senses[0]?.value ?? "",
    },
  });
  const answerIndex = form.watch("answerIndex");
  const options = form.watch("options");

  useEffect(() => {
    if (!current || current.kind === "reading") return;
    form.reset({
      answerIndex: current.answerIndex,
      difficulty: current.difficulty,
      explanation: current.explanation ?? "",
      options: [0, 1, 2, 3].map((index) => current.options[index] ?? ""),
      prompt: current.prompt,
      questionStyle: current.questionStyle,
      source: senseKey(current.wordKey, current.senseId),
    });
  }, [current, form]);

  useEffect(() => {
    if (!current && senses[0] && !form.getValues("source"))
      form.setValue("source", senses[0].value);
  }, [current, form, senses]);

  const submit = form.handleSubmit(async (values) => {
    const source = parseSenseKey(values.source, state.words);
    if (!source) {
      form.setError("source", { message: t("questions.unknownSense") });
      return;
    }
    const { senseId, wordKey } = source;
    const timestamp = new Date().toISOString();
    const question: MultipleChoiceQuestion = {
      answerIndex: Number(values.answerIndex),
      createdAt: current?.createdAt ?? timestamp,
      difficulty: Number(values.difficulty) as 1 | 2 | 3,
      explanation: values.explanation.trim() || undefined,
      fingerprint: current?.fingerprint ?? "pending",
      id: current?.id ?? randomUUID(),
      kind: "multipleChoice",
      options: values.options.map((value) => value.trim()),
      prompt: values.prompt.trim(),
      questionStyle: values.questionStyle,
      senseId,
      updatedAt: timestamp,
      wordKey,
    };
    // The store validates on save; without this the button silently did
    // nothing and the reason only appeared in the console.
    try {
      const result = await saveQuestion(question as LibraryQuestion);
      if (result === "duplicate") {
        form.setError("root", { message: t("questions.duplicate") });
        return;
      }
    } catch (reason) {
      form.setError("root", {
        message: reason instanceof Error ? reason.message : String(reason),
      });
      return;
    }
    router.push("/questions");
  });

  return (
    <form className="mx-auto max-w-3xl" onSubmit={submit}>
      <PageHeader
        back={
          <Button asChild size="sm" variant="ghost">
            <Link href="/questions">
              <Icons.back />
              {t("common.back")}
            </Link>
          </Button>
        }
        title={questionId ? t("questions.edit") : t("questions.new")}
      />

      <div className="rule-card grid gap-4 py-6 sm:grid-cols-2">
        <SelectField
          label={t("questions.type")}
          onValueChange={(value) =>
            form.setValue("questionStyle", value as Values["questionStyle"])
          }
          options={sentenceStyleOptions()}
          value={form.watch("questionStyle")}
        />
        <SelectField
          label={t("practice.difficulty")}
          onValueChange={(value) =>
            form.setValue("difficulty", Number(value) as Values["difficulty"])
          }
          options={difficultyOptions()}
          value={String(form.watch("difficulty"))}
        />
        <SelectField
          className="sm:col-span-2"
          label={t("questions.linkedSense")}
          onValueChange={(value) => form.setValue("source", value)}
          options={senses}
          placeholder={t("questions.selectSense")}
          value={form.watch("source")}
        />
      </div>

      <div className="mt-7 grid gap-5">
        <Field label={t("questions.prompt")}>
          <Input {...form.register("prompt", { required: true })} />
        </Field>

        <AnswerOptions
          answerIndex={answerIndex}
          name="answerIndex"
          onAnswerChange={(index) => form.setValue("answerIndex", index)}
          onOptionChange={(index, value) =>
            form.setValue(
              "options",
              options.map((option, at) => (at === index ? value : option)),
            )
          }
          options={options}
        />

        <Field label={t("questions.explanation")}>
          <Textarea {...form.register("explanation")} className="min-h-20" />
        </Field>
      </div>

      {form.formState.errors.root && (
        <p className="mt-6 text-sm text-destructive" role="alert">
          {form.formState.errors.root.message}
        </p>
      )}

      <div className="mt-7 flex justify-end">
        <Button size="lg" type="submit">
          <Icons.success />
          {t("questions.save")}
        </Button>
      </div>
    </form>
  );
}

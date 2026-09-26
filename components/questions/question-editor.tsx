"use client";

import type {
  LibraryQuestion,
  MultipleChoiceQuestion,
  QuestionStyle,
} from "@/types";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";

import { useResumableDraft } from "@/components/ai/use-resumable-draft";
import { AnswerOptions } from "@/components/questions/answer-options";
import { BackControl } from "@/components/ui/back-control";
import { Button } from "@/components/ui/button";
import { DraftSaveStatus } from "@/components/ui/draft-save-status";
import { Field } from "@/components/ui/field";
import { Icons } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { LoadingState } from "@/components/ui/page-state";
import { ResumeChoice } from "@/components/ui/resume-choice";
import { SelectField } from "@/components/ui/select-field";
import { Textarea } from "@/components/ui/textarea";
import { StepActions } from "@/components/ui/step-actions";
import { t } from "@/lib/i18n";
import { LIBRARY_QUESTIONS_HREF } from "@/lib/routes";
import { randomUUID } from "@/src/lib/id";
import { parseSenseKey, senseKey } from "@/src/lib/library";
import {
  difficultyOptions,
  sentenceStyleOptions,
} from "@/lib/question-options";
import { useLibraryStore } from "@/stores/library-store";
import { useCloudStore } from "@/stores/cloud-store";

interface Values {
  answerIndex: number;
  difficulty: 1 | 2 | 3;
  explanation: string;
  options: string[];
  prompt: string;
  questionStyle: QuestionStyle;
  source: string;
}

export function QuestionEditor({ questionId }: { questionId: string }) {
  const state = useLibraryStore((store) => store.state);
  const current = state.questions.find((entry) => entry.id === questionId);
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
  return (
    <QuestionEditorForm
      key={`${questionId}:${current?.updatedAt ?? senses[0]?.value ?? "new"}`}
      questionId={questionId}
      current={current}
      senses={senses}
    />
  );
}

function QuestionEditorForm({
  questionId,
  current,
  senses,
}: {
  questionId: string;
  current: LibraryQuestion | undefined;
  senses: { label: string; value: string }[];
}) {
  const router = useRouter();
  const uid = useCloudStore((store) => store.user?.uid);
  const { state, saveQuestion } = useLibraryStore();
  const initial: Values =
    current && current.kind !== "reading"
      ? {
          answerIndex: current.answerIndex,
          difficulty: current.difficulty,
          explanation: current.explanation ?? "",
          options: [0, 1, 2, 3].map((index) => current.options[index] ?? ""),
          prompt: current.prompt,
          questionStyle: current.questionStyle,
          source: senseKey(current.wordKey, current.senseId),
        }
      : {
          answerIndex: 0,
          difficulty: 1,
          explanation: "",
          options: ["", "", "", ""],
          prompt: "",
          questionStyle: "vocabulary",
          source: senses[0]?.value ?? "",
        };
  const saved = useResumableDraft<Values>(
    `lexiro:flow-draft:v1:${uid ?? "local"}:edit-question:${questionId}:${current?.updatedAt ?? "new"}`,
    initial,
  );
  const form = useForm<Values>({
    defaultValues: initial,
  });
  const answerIndex = form.watch("answerIndex");
  const options = form.watch("options");

  useEffect(() => {
    if (saved.status !== "active") return;
    const subscription = form.watch(() => {
      form.clearErrors("root");
      saved.update(form.getValues());
    });
    return () => subscription.unsubscribe();
  }, [form, saved.status, saved.update]);

  const submit = form.handleSubmit(async (values) => {
    const missingOption = values.options.findIndex((option) => !option.trim());
    if (missingOption >= 0) {
      form.setError("root", { message: t("questions.optionsRequired") });
      document
        .querySelector<HTMLInputElement>(
          `input[name="answerIndex-option-${missingOption}"]`,
        )
        ?.focus();
      return;
    }
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
    saved.clear();
    router.push(LIBRARY_QUESTIONS_HREF);
  });

  if (saved.status === "checking") return <LoadingState />;
  if (saved.status === "offer" || saved.status === "invalid")
    return (
      <ResumeChoice
        back={<BackControl href={LIBRARY_QUESTIONS_HREF} />}
        description={t(
          saved.status === "invalid"
            ? "draft.invalidDescription"
            : "draft.questionEditDescription",
        )}
        invalid={saved.status === "invalid"}
        onRestart={() => {
          saved.restart();
          form.reset(initial);
        }}
        onResume={() => {
          form.reset(saved.pending!);
          saved.resume();
        }}
      />
    );

  return (
    <form
      className="mx-auto max-w-3xl"
      id="question-editor-form"
      onSubmit={submit}
    >
      <PageHeader
        actions={<DraftSaveStatus status={saved.persistence} />}
        back={<BackControl href={LIBRARY_QUESTIONS_HREF} />}
        title={t("questions.edit")}
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

      <StepActions width="wide">
        {(form.formState.errors.root ||
          form.formState.errors.source ||
          form.formState.errors.prompt) && (
          <p className="text-sm text-destructive" role="alert">
            {form.formState.errors.root?.message ??
              form.formState.errors.source?.message ??
              t("questions.fixErrors")}
          </p>
        )}
        <Button
          disabled={form.formState.isSubmitting}
          form="question-editor-form"
          size="lg"
          type="submit"
        >
          <Icons.success />
          {t(
            form.formState.isSubmitting ? "setEditor.saving" : "questions.save",
          )}
        </Button>
      </StepActions>
    </form>
  );
}

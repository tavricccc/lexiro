"use client";

import type {
  LibraryQuestion,
  MultipleChoiceQuestion,
  QuestionStyle,
} from "@/types";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import { useResumableDraft } from "@/components/ai/use-resumable-draft";
import { AnswerOptions } from "@/components/questions/answer-options";
import { BackControl } from "@/components/ui/back-control";
import { Button } from "@/components/ui/button";
import { DraftSaveStatus } from "@/components/ui/draft-save-status";
import { Field } from "@/components/ui/field";
import { Icons } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, LoadingState } from "@/components/ui/page-state";
import { ResumeChoice } from "@/components/ui/resume-choice";
import { SelectField } from "@/components/ui/select-field";
import { Textarea } from "@/components/ui/textarea";
import { StepActions } from "@/components/ui/step-actions";
import { t } from "@/lib/i18n";
import { LIBRARY_QUESTIONS_HREF } from "@/lib/routes";
import { randomUUID } from "@/src/lib/id";
import { parseSenseKey, senseKey } from "@/src/lib/library";
import { difficultyOptions } from "@/lib/question-options";
import { useLibraryStore } from "@/stores/library-store";
import { useCloudStore } from "@/stores/cloud-store";
import {
  QuestionWorkspace,
  type QuestionWorkspacePane,
} from "./question-workspace";
import { QuestionPreview } from "./question-preview";
import { DistractorReasonsEditor } from "./distractor-reasons-editor";
import { normalizeOptionReasons, remapOptionReasons } from "./option-reasons";
import {
  draftSourceSetId,
  questionSourceOptions,
  questionSourceSetId,
  questionSourceWords,
} from "./question-source-scope";

interface Values {
  answerIndex: number;
  difficulty: 1 | 2 | 3;
  explanation: string;
  options: string[];
  prompt: string;
  questionStyle: QuestionStyle;
  selectedSetId: string;
  source: string;
  whyWrong?: Record<string, string>;
  reasonsVersion: 1;
}

export function QuestionEditor({
  questionId,
  returnHref = LIBRARY_QUESTIONS_HREF,
}: {
  questionId: string;
  returnHref?: string;
}) {
  const state = useLibraryStore((store) => store.state);
  const current = state.questions.find((entry) => entry.id === questionId);
  if (current?.kind === "multipleChoice" && current.questionStyle === "grammar")
    return (
      <div>
        <PageHeader
          back={<BackControl href={returnHref} />}
          title={t("questions.retiredTitle")}
        />
        <EmptyState
          title={t("questions.retiredTitle")}
          description={t("questions.retiredHint")}
        />
      </div>
    );
  return (
    <QuestionEditorForm
      key={`${questionId}:${current?.updatedAt ?? "new"}`}
      questionId={questionId}
      current={current}
      returnHref={returnHref}
    />
  );
}

function QuestionEditorForm({
  questionId,
  current,
  returnHref,
}: {
  questionId: string;
  current: LibraryQuestion | undefined;
  returnHref: string;
}) {
  const router = useRouter();
  const uid = useCloudStore((store) => store.user?.uid);
  const { state, saveQuestion } = useLibraryStore();
  const originalSetId = current
    ? questionSourceSetId(state, current)
    : undefined;
  const initialSetId = current
    ? (originalSetId ?? "")
    : (state.sets[0]?.id ?? "");
  const initialSenses = questionSourceOptions(
    questionSourceWords(state, initialSetId),
  );
  const initial: Values =
    current && current.kind !== "reading"
      ? {
          answerIndex: current.answerIndex,
          difficulty: current.difficulty,
          explanation: current.explanation ?? "",
          options: [0, 1, 2, 3].map((index) => current.options[index] ?? ""),
          prompt: current.prompt,
          questionStyle: current.questionStyle,
          selectedSetId: initialSetId,
          source: senseKey(current.wordKey, current.senseId),
          whyWrong: current.whyWrong,
          reasonsVersion: 1,
        }
      : {
          answerIndex: 0,
          difficulty: 1,
          explanation: "",
          options: ["", "", "", ""],
          prompt: "",
          questionStyle: "vocabulary",
          selectedSetId: initialSetId,
          source: initialSenses[0]?.value ?? "",
          reasonsVersion: 1,
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
  const [pane, setPane] = useState<QuestionWorkspacePane>("passage");
  const values = form.watch();
  const selectedSetId = current ? (originalSetId ?? "") : values.selectedSetId;
  const sourceWords = useMemo(
    () => questionSourceWords(state, selectedSetId),
    [selectedSetId, state.memberships, state.words],
  );
  const senses = useMemo(
    () => questionSourceOptions(sourceWords),
    [sourceWords],
  );
  const previewSource = parseSenseKey(values.source, sourceWords);
  const preview: MultipleChoiceQuestion | null = previewSource
    ? {
        id: "editing-preview",
        fingerprint: "editing-preview",
        kind: "multipleChoice",
        questionStyle: values.questionStyle,
        difficulty: Number(values.difficulty) as 1 | 2 | 3,
        prompt: values.prompt,
        options: values.options,
        answerIndex: values.answerIndex,
        explanation: values.explanation,
        whyWrong: normalizeOptionReasons(
          values.options,
          values.whyWrong,
          values.answerIndex,
        ),
        wordKey: previewSource.wordKey,
        senseId: previewSource.senseId,
        createdAt: current?.createdAt ?? "",
        updatedAt: current?.updatedAt ?? "",
      }
    : null;

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
    const source = parseSenseKey(values.source, sourceWords);
    if (!source) {
      form.setError("source", { message: t("questions.sourceOutsideSet") });
      return;
    }
    const { senseId, wordKey } = source;
    const timestamp = new Date().toISOString();
    const question: MultipleChoiceQuestion = {
      answerIndex: Number(values.answerIndex),
      createdAt: current?.createdAt ?? timestamp,
      difficulty: Number(values.difficulty) as 1 | 2 | 3,
      explanation: values.explanation.trim() || undefined,
      whyWrong: normalizeOptionReasons(
        values.options,
        values.whyWrong,
        Number(values.answerIndex),
      ),
      fingerprint: current?.fingerprint ?? "pending",
      id: current?.id ?? randomUUID(),
      kind: "multipleChoice",
      options: values.options.map((value) => value.trim()),
      prompt: values.prompt.trim(),
      questionStyle: values.questionStyle,
      senseId,
      updatedAt: timestamp,
      wordKey,
      ...(current?.kind === "multipleChoice" ? { trap: current.trap } : {}),
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
    router.push(returnHref);
  });

  if (saved.status === "checking") return <LoadingState />;
  if (saved.status === "offer" || saved.status === "invalid")
    return (
      <ResumeChoice
        back={<BackControl href={returnHref} />}
        description={t(
          saved.status === "invalid"
            ? "draft.invalidDescription"
            : "draft.questionEditDescription",
        )}
        invalid={
          saved.status === "invalid" ||
          saved.pending?.questionStyle === "grammar"
        }
        onRestart={() => {
          saved.restart();
          form.reset(initial);
        }}
        onResume={() => {
          const pending = saved.pending! as
            Values | Omit<Values, "reasonsVersion" | "selectedSetId">;
          const restored: Values = {
            ...pending,
            selectedSetId: current
              ? (originalSetId ?? "")
              : "selectedSetId" in pending
                ? pending.selectedSetId
                : (draftSourceSetId(state, [pending.source]) ?? ""),
            reasonsVersion: 1,
            whyWrong:
              "reasonsVersion" in pending
                ? pending.whyWrong
                : remapOptionReasons(
                    initial.options,
                    pending.options,
                    initial.whyWrong,
                    pending.answerIndex,
                  ),
          };
          form.reset(restored);
          saved.resume();
          saved.update(restored);
        }}
      />
    );

  return (
    <form
      className="mx-auto max-w-6xl"
      id="question-editor-form"
      onSubmit={submit}
    >
      <PageHeader
        actions={<DraftSaveStatus status={saved.persistence} />}
        back={<BackControl href={returnHref} />}
        title={t("questions.editFormat", { name: t("questions.vocabulary") })}
      />

      <QuestionWorkspace
        pane={pane}
        onPaneChange={setPane}
        passageLabel={t("questions.editing")}
        questionsLabel={t("questions.preview")}
        passage={
          <div>
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                description={t(
                  current
                    ? "questions.originalSourceSetHint"
                    : "questions.sourceSetHint",
                )}
                disabled={Boolean(current)}
                label={t("questions.sourceSet")}
                onValueChange={(value) => {
                  form.setValue("selectedSetId", value);
                  form.setValue("source", "");
                  form.clearErrors("source");
                }}
                options={state.sets.map((set) => ({
                  label: set.setName,
                  value: set.id,
                }))}
                placeholder={t("questions.selectSourceSet")}
                value={selectedSetId}
              />
              <SelectField
                label={t("practice.difficulty")}
                onValueChange={(value) =>
                  form.setValue(
                    "difficulty",
                    Number(value) as Values["difficulty"],
                  )
                }
                options={difficultyOptions()}
                value={String(form.watch("difficulty"))}
              />
              <SelectField
                className="sm:col-span-2"
                label={t("questions.linkedSense")}
                onValueChange={(value) => {
                  form.setValue("source", value);
                  form.clearErrors("source");
                }}
                options={senses}
                placeholder={t("questions.selectSense")}
                value={form.watch("source")}
              />
            </div>

            <div className="mt-7 grid gap-5">
              <Field label={t("questions.prompt")}>
                <Textarea
                  {...form.register("prompt", { required: true })}
                  className="min-h-28 text-base leading-7"
                />
              </Field>

              <AnswerOptions
                answerIndex={answerIndex}
                name="answerIndex"
                onAnswerChange={(index) => {
                  form.setValue(
                    "whyWrong",
                    remapOptionReasons(
                      options,
                      options,
                      values.whyWrong,
                      index,
                    ),
                  );
                  form.setValue("answerIndex", index);
                }}
                onOptionChange={(index, value) => {
                  const nextOptions = options.map((option, at) =>
                    at === index ? value : option,
                  );
                  form.setValue(
                    "whyWrong",
                    remapOptionReasons(
                      options,
                      nextOptions,
                      values.whyWrong,
                      answerIndex,
                    ),
                  );
                  form.setValue("options", nextOptions);
                }}
                options={options}
              />

              <Field label={t("questions.explanation")}>
                <Textarea
                  {...form.register("explanation")}
                  className="min-h-24 text-base leading-7"
                />
              </Field>
              <DistractorReasonsEditor
                options={options}
                answerIndex={answerIndex}
                reasons={values.whyWrong}
                onChange={(reasons) => form.setValue("whyWrong", reasons)}
              />
            </div>
          </div>
        }
        questions={
          <section className="space-y-5 rule-t pt-5 lg:border-t-0 lg:pt-0">
            <h2 className="text-base font-semibold">
              {t("questions.preview")}
            </h2>
            {preview ? (
              <QuestionPreview question={preview} />
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("questions.selectSense")}
              </p>
            )}
          </section>
        }
      />

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

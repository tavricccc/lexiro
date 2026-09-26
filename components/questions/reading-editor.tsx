"use client";

import type { ReadingPack } from "@/types";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { useResumableDraft } from "@/components/ai/use-resumable-draft";
import {
  ReadingChildEditor,
  type ReadingChildDraft,
  type ReadingChildErrors,
} from "@/components/questions/reading-child-editor";
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
import { difficultyOptions } from "@/lib/question-options";
import { useLibraryStore } from "@/stores/library-store";
import { useCloudStore } from "@/stores/cloud-store";

interface ReadingFormDraft {
  title: string;
  passage: string;
  difficulty: 1 | 2 | 3;
  children: ReadingChildDraft[];
}

const emptyChild = (): ReadingChildDraft => ({
  answerIndex: 0,
  options: ["", "", "", ""],
  prompt: "",
  source: "",
});

export function ReadingEditor({ readingId }: { readingId: string }) {
  const router = useRouter();
  const uid = useCloudStore((store) => store.user?.uid);
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

  const current = readingId
    ? state.questions.find(
        (question) => question.id === readingId && question.kind === "reading",
      )
    : undefined;
  const saved = useResumableDraft<ReadingFormDraft>(
    `lexiro:flow-draft:v1:${uid ?? "local"}:edit-reading:${readingId}:${current?.updatedAt ?? "new"}`,
    {
      title: current?.kind === "reading" ? current.title : "",
      passage: current?.kind === "reading" ? current.passage : "",
      difficulty: current?.kind === "reading" ? current.difficulty : 2,
      children:
        current?.kind === "reading"
          ? current.questions.map((child) => ({
              answerIndex: child.answerIndex,
              id: child.id,
              options: [...child.options],
              prompt: child.prompt,
              source: senseKey(child.wordKey, child.senseId),
            }))
          : [emptyChild(), emptyChild(), emptyChild()],
    },
  );
  const { title, passage, difficulty, children } = saved.draft;
  const titleRef = useRef<HTMLInputElement>(null);
  const passageRef = useRef<HTMLTextAreaElement>(null);
  const childrenRef = useRef<HTMLDivElement>(null);
  // Validation stays quiet until the first submit, so a half-filled form is
  // not already shouting at someone who has just started typing.
  const [submitted, setSubmitted] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const savePending = useRef(false);
  const previousDraft = useRef(saved.draft);
  useEffect(() => {
    if (previousDraft.current === saved.draft) return;
    previousDraft.current = saved.draft;
    setSaveError("");
  }, [saved.draft]);

  const update = (index: number, value: Partial<ReadingChildDraft>) =>
    saved.update({
      children: children.map((item, at) =>
        at === index ? { ...item, ...value } : item,
      ),
    });

  const childErrors: ReadingChildErrors[] = children.map((child) => ({
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
    childErrors.every(
      (errors) => !errors.options && !errors.prompt && !errors.source,
    );

  const submit = async () => {
    if (savePending.current) return;
    setSubmitted(true);
    setSaveError("");
    if (!valid) {
      const firstChild = childErrors.findIndex(
        (errors) => errors.source || errors.prompt || errors.options,
      );
      const section = childrenRef.current?.querySelectorAll(
        "[data-reading-child]",
      )[firstChild];
      const target = titleError
        ? titleRef.current
        : passageError
          ? passageRef.current
          : childErrors[firstChild]?.source
            ? section?.querySelector<HTMLElement>("[role=combobox]")
            : childErrors[firstChild]?.prompt
              ? section?.querySelector<HTMLElement>(
                  "input[name^=reading-prompt]",
                )
              : section?.querySelector<HTMLElement>("input[name$=option-0]");
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    const timestamp = new Date().toISOString();
    const sources = children.map((child) =>
      parseSenseKey(child.source, state.words),
    );
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
    savePending.current = true;
    setSaving(true);
    try {
      const result = await saveQuestion(pack);
      if (result === "duplicate") {
        setSaveError(t("questions.duplicate"));
        return;
      }
      saved.clear();
      router.push(LIBRARY_QUESTIONS_HREF);
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      savePending.current = false;
      setSaving(false);
    }
  };

  if (saved.status === "checking") return <LoadingState />;
  if (saved.status === "offer" || saved.status === "invalid")
    return (
      <ResumeChoice
        back={<BackControl href={LIBRARY_QUESTIONS_HREF} />}
        description={t(
          saved.status === "invalid"
            ? "draft.invalidDescription"
            : "draft.readingEditDescription",
        )}
        invalid={saved.status === "invalid"}
        onRestart={saved.restart}
        onResume={saved.resume}
      />
    );

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        actions={<DraftSaveStatus status={saved.persistence} />}
        back={<BackControl href={LIBRARY_QUESTIONS_HREF} />}
        title={t("questions.editReading")}
      />

      <fieldset className="min-w-0 border-0 p-0" disabled={saving}>
        <div className="grid gap-4">
          <Field
            error={submitted && titleError}
            label={t("questions.readingTitle")}
          >
            <Input
              onChange={(event) => saved.update({ title: event.target.value })}
              placeholder={t("questions.readingTitle")}
              ref={titleRef}
              value={title}
            />
          </Field>
          <Field
            error={submitted && passageError}
            label={t("questions.passage")}
          >
            <Textarea
              className="min-h-52 text-[1.0625rem] leading-[1.75]"
              onChange={(event) =>
                saved.update({ passage: event.target.value })
              }
              placeholder={t("questions.passage")}
              ref={passageRef}
              value={passage}
            />
          </Field>
          <SelectField
            className="sm:max-w-56"
            label={t("practice.difficulty")}
            onValueChange={(value) =>
              saved.update({ difficulty: Number(value) as 1 | 2 | 3 })
            }
            options={difficultyOptions()}
            value={String(difficulty)}
          />
        </div>

        <div className="section-gap rule-card rule-list" ref={childrenRef}>
          {children.map((child, index) => (
            <ReadingChildEditor
              child={child}
              errors={childErrors[index]}
              index={index}
              key={child.id ?? index}
              onRemove={
                children.length > 1
                  ? () =>
                      saved.update({
                        children: children.filter((_, at) => at !== index),
                      })
                  : undefined
              }
              onUpdate={(patch) => update(index, patch)}
              senses={senses}
              submitted={submitted}
            />
          ))}
        </div>

        <Button
          className="mt-6"
          onClick={() =>
            saved.update({ children: [...children, emptyChild()] })
          }
          size="sm"
          type="button"
          variant="secondary"
        >
          <Icons.create />
          {t("questions.addChild")}
        </Button>
      </fieldset>
      <StepActions width="wide">
        {(saveError || (submitted && !valid)) && (
          <p className="text-sm text-destructive" role="alert">
            {saveError || t("questions.fixErrors")}
          </p>
        )}
        <Button
          disabled={saving}
          onClick={() => void submit()}
          size="lg"
          type="button"
        >
          <Icons.success />
          {t(saving ? "setEditor.saving" : "questions.save")}
        </Button>
      </StepActions>
    </div>
  );
}

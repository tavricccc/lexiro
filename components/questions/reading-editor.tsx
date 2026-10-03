"use client";

import type { ReadingPack } from "@/types";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { countEnglishWords } from "@lexiro/ai-contract";
import { useResumableDraft } from "@/components/ai/use-resumable-draft";
import { PassageView } from "@/components/practice/passage-view";
import {
  ReadingChildEditor,
  type ReadingChildDraft,
  type ReadingChildErrors,
} from "./reading-child-editor";
import { QuestionPager } from "./question-pager";
import {
  QuestionWorkspace,
  type QuestionWorkspacePane,
} from "./question-workspace";
import {
  emptyReadingChild,
  migrateReadingFormDraft,
  readingFormFromPack,
  readingPackFromForm,
  updateReadingOptionBank,
  type ReadingFormDraft,
} from "./reading-form";
import { BackControl } from "@/components/ui/back-control";
import { Button } from "@/components/ui/button";
import { DraftSaveStatus } from "@/components/ui/draft-save-status";
import { Field } from "@/components/ui/field";
import { Icons } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { LiquidTabs } from "@/components/ui/liquid-tabs";
import { PageHeader } from "@/components/ui/page-header";
import { LoadingState } from "@/components/ui/page-state";
import { ResumeChoice } from "@/components/ui/resume-choice";
import { SelectField } from "@/components/ui/select-field";
import { Textarea } from "@/components/ui/textarea";
import { StepActions } from "@/components/ui/step-actions";
import { t } from "@/lib/i18n";
import { LIBRARY_QUESTIONS_HREF } from "@/lib/routes";
import { senseKey } from "@/src/lib/library";
import { difficultyOptions, questionFormatLabel } from "@/lib/question-options";
import { useLibraryStore } from "@/stores/library-store";
import { useCloudStore } from "@/stores/cloud-store";

export function ReadingEditor({
  readingId,
  returnHref = LIBRARY_QUESTIONS_HREF,
}: {
  readingId: string;
  returnHref?: string;
}) {
  const router = useRouter();
  const uid = useCloudStore((store) => store.user?.uid);
  const { state, saveQuestion } = useLibraryStore();
  const found = state.questions.find((question) => question.id === readingId);
  const current: ReadingPack | undefined =
    found?.kind === "reading" ? found : undefined;
  const initial = readingFormFromPack(current);
  const saved = useResumableDraft<ReadingFormDraft>(
    `lexiro:flow-draft:v1:${uid ?? "local"}:edit-reading:${readingId}:${current?.updatedAt ?? "new"}`,
    initial,
  );
  const { title, passage, difficulty, format, children, optionBank } =
    saved.draft;
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
  const [pane, setPane] = useState<QuestionWorkspacePane>("passage");
  const [articleMode, setArticleMode] = useState("edit");
  const [questionMode, setQuestionMode] = useState("answers");
  const [index, setIndex] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const savePending = useRef(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const passageRef = useRef<HTMLTextAreaElement>(null);
  const questionRef = useRef<HTMLDivElement>(null);
  const previousDraft = useRef(saved.draft);
  const blankId = useId();
  useEffect(() => {
    if (previousDraft.current === saved.draft) return;
    previousDraft.current = saved.draft;
    setSaveError("");
  }, [saved.draft]);

  const update = (at: number, value: Partial<ReadingChildDraft>) =>
    saved.update({
      children: children.map((child, position) =>
        position === at ? { ...child, ...value } : child,
      ),
    });
  const childErrors: ReadingChildErrors[] = children.map((child) => ({
    options: (optionBank ?? child.options).some((option) => !option.trim())
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
  const activeChild = children[index];
  const fullPassage = children.reduce(
    (text, child) =>
      child.blank === undefined
        ? text
        : text.replace(
            `__${child.blank}__`,
            (optionBank ?? child.options)[child.answerIndex],
          ),
    passage,
  );
  const locate = () => {
    setArticleMode("preview");
    setPane("passage");
    requestAnimationFrame(() =>
      document
        .getElementById(blankId)
        ?.scrollIntoView({ block: "center", behavior: "smooth" }),
    );
  };
  const submit = async () => {
    if (savePending.current) return;
    setSubmitted(true);
    setSaveError("");
    if (!valid) {
      if (titleError) {
        setPane("passage");
        titleRef.current?.focus();
      } else if (passageError) {
        setPane("passage");
        setArticleMode("edit");
        requestAnimationFrame(() => passageRef.current?.focus());
      } else {
        const missing = childErrors.findIndex(
          (errors) => errors.options || errors.prompt || errors.source,
        );
        setIndex(missing);
        setQuestionMode(
          optionBank && optionBank.some((option) => !option.trim())
            ? "bank"
            : "answers",
        );
        setPane("questions");
        requestAnimationFrame(() => {
          const selector = childErrors[missing].source
            ? '[role="combobox"]'
            : childErrors[missing].prompt
              ? 'textarea[name^="reading-prompt"]'
              : 'input[name$="option-0"], textarea';
          questionRef.current?.querySelector<HTMLElement>(selector)?.focus();
        });
      }
      return;
    }
    savePending.current = true;
    setSaving(true);
    try {
      const result = await saveQuestion(
        readingPackFromForm(saved.draft, state.words, current),
      );
      if (result === "duplicate") {
        setSaveError(t("questions.duplicate"));
        return;
      }
      saved.clear();
      router.push(returnHref);
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
        back={<BackControl href={returnHref} />}
        description={t(
          saved.status === "invalid"
            ? "draft.invalidDescription"
            : "draft.readingEditDescription",
        )}
        invalid={saved.status === "invalid"}
        onRestart={saved.restart}
        onResume={() => {
          const migrated = migrateReadingFormDraft(saved.pending!, initial);
          saved.resume();
          saved.update(migrated);
        }}
      />
    );

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        actions={<DraftSaveStatus status={saved.persistence} />}
        back={<BackControl href={returnHref} />}
        title={t("questions.editFormat", { name: questionFormatLabel(format) })}
      />
      <fieldset className="min-w-0 border-0 p-0" disabled={saving}>
        <div className="mb-6 grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
          <Field
            error={submitted && titleError}
            label={t("questions.readingTitle")}
          >
            <Input
              ref={titleRef}
              value={title}
              onChange={(event) => saved.update({ title: event.target.value })}
              className="text-base"
            />
          </Field>
          <SelectField
            label={t("practice.difficulty")}
            value={String(difficulty)}
            options={difficultyOptions()}
            onValueChange={(value) =>
              saved.update({ difficulty: Number(value) as 1 | 2 | 3 })
            }
          />
        </div>
        <QuestionWorkspace
          pane={pane}
          onPaneChange={setPane}
          passage={
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <LiquidTabs
                  ariaLabel={t("questions.editorTabs")}
                  value={articleMode}
                  options={[
                    { value: "edit", label: t("questions.editPassage") },
                    { value: "preview", label: t("questions.passagePreview") },
                  ]}
                  onValueChange={setArticleMode}
                />
                <span className="text-sm text-muted-foreground">
                  {t("questions.passageWordCount", {
                    count: countEnglishWords(fullPassage),
                  })}
                </span>
              </div>
              {articleMode === "edit" ? (
                <Field
                  error={submitted && passageError}
                  label={t("questions.passage")}
                >
                  <Textarea
                    ref={passageRef}
                    value={passage}
                    onChange={(event) =>
                      saved.update({ passage: event.target.value })
                    }
                    className="h-[min(60dvh,34rem)] min-h-80 resize-y text-base leading-8"
                  />
                </Field>
              ) : (
                <div className="rounded-[var(--radius-card)] bg-card p-5 sm:p-6">
                  <div className="max-w-[68ch]">
                    <PassageView
                      passage={passage}
                      activeBlank={activeChild.blank}
                      activeBlankId={blankId}
                    />
                  </div>
                </div>
              )}
              <details className="rule-t pt-3">
                <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium md:min-h-9">
                  {t("questions.explanation")}
                </summary>
                <Textarea
                  aria-label={t("questions.explanation")}
                  value={saved.draft.explanation ?? ""}
                  onChange={(event) =>
                    saved.update({ explanation: event.target.value })
                  }
                  className="mt-3 min-h-24 text-base leading-7"
                />
              </details>
            </div>
          }
          questions={
            <div className="space-y-5" ref={questionRef}>
              {optionBank && (
                <LiquidTabs
                  ariaLabel={t("questions.questionsPane")}
                  value={questionMode}
                  options={[
                    { value: "answers", label: t("questions.answerKey") },
                    { value: "bank", label: t("questions.sharedOptions") },
                  ]}
                  onValueChange={setQuestionMode}
                />
              )}
              {questionMode === "bank" && optionBank ? (
                <div className="space-y-4">
                  <p className="text-sm leading-6 text-muted-foreground">
                    {t("questions.optionBankHint")}
                  </p>
                  <div className="grid gap-3">
                    {optionBank.map((option, at) => (
                      <Field
                        key={at}
                        label={String.fromCharCode(65 + at)}
                        error={
                          submitted &&
                          !option.trim() &&
                          t("questions.optionsRequired")
                        }
                      >
                        {format === "discourse" ? (
                          <Textarea
                            aria-label={`${t("questions.optionBank")} ${String.fromCharCode(65 + at)}`}
                            value={option}
                            onChange={(event) =>
                              saved.update(
                                updateReadingOptionBank(
                                  saved.draft,
                                  at,
                                  event.target.value,
                                ),
                              )
                            }
                            className="min-h-20 text-base leading-7"
                          />
                        ) : (
                          <Input
                            aria-label={`${t("questions.optionBank")} ${String.fromCharCode(65 + at)}`}
                            value={option}
                            onChange={(event) =>
                              saved.update(
                                updateReadingOptionBank(
                                  saved.draft,
                                  at,
                                  event.target.value,
                                ),
                              )
                            }
                            className="text-base"
                          />
                        )}
                      </Field>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <QuestionPager
                    index={index}
                    total={children.length}
                    blanks={format !== "reading"}
                    disabled={saving}
                    onChange={setIndex}
                  />
                  {activeChild.blank && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={locate}
                    >
                      <Icons.search />
                      {t("questions.locateBlank", { index: activeChild.blank })}
                    </Button>
                  )}
                  <ReadingChildEditor
                    key={activeChild.id ?? index}
                    child={activeChild}
                    errors={childErrors[index]}
                    index={index}
                    onUpdate={(patch) => update(index, patch)}
                    onRemove={
                      format === "reading" && children.length > 1
                        ? () => {
                            saved.update({
                              children: children.filter(
                                (_, at) => at !== index,
                              ),
                            });
                            setIndex(Math.max(0, index - 1));
                          }
                        : undefined
                    }
                    senses={senses}
                    submitted={submitted}
                    sharedBank={optionBank}
                    blankFormat={format !== "reading"}
                  />
                  {format === "reading" && (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        saved.update({
                          children: [...children, emptyReadingChild()],
                        });
                        setIndex(children.length);
                        setPane("questions");
                      }}
                    >
                      <Icons.create />
                      {t("questions.addChild")}
                    </Button>
                  )}
                </>
              )}
            </div>
          }
        />
      </fieldset>
      {saveError && (
        <p className="mt-5 text-sm text-destructive" role="alert">
          {saveError}
        </p>
      )}
      {submitted && !valid && (
        <p className="mt-5 text-sm text-destructive" role="alert">
          {t("questions.fixErrors")}
        </p>
      )}
      <StepActions width="wide">
        <Button
          disabled={saving}
          onClick={() => void submit()}
          type="button"
          size="lg"
        >
          <Icons.success />
          {t(saving ? "setEditor.saving" : "questions.save")}
        </Button>
      </StepActions>
    </div>
  );
}

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useFieldArray, useForm } from "react-hook-form";

import {
  emptyWord,
  setFormSchema,
  type SetFormValues,
} from "@/components/library/set-form";
import { SetWordFields } from "@/components/library/set-word-fields";
import { useResumableDraft } from "@/components/ai/use-resumable-draft";
import { BackControl } from "@/components/ui/back-control";
import { Button } from "@/components/ui/button";
import { ChoiceList } from "@/components/ui/choice-list";
import { LoadingState } from "@/components/ui/page-state";
import { ResumeChoice } from "@/components/ui/resume-choice";
import { ListInputRow, ListSection } from "@/components/ui/list";
import { Icons } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { StepActions } from "@/components/ui/step-actions";
import { t } from "@/lib/i18n";
import { useLibraryStore } from "@/stores/library-store";
import { useCloudStore } from "@/stores/cloud-store";
import { UNCATEGORIZED_FOLDER_ID } from "@/src/lib/folders";
import { createUniqueSetName } from "@/src/lib/set-name";

interface SetEditorDraft {
  entry: "ask" | "manual";
  form: SetFormValues;
}

/** Choose manual entry or AI generation before opening either workflow. */
export function SetEditor({ initialFolderId }: { initialFolderId?: string }) {
  const uid = useCloudStore((store) => store.user?.uid);
  const saved = useResumableDraft<SetEditorDraft>(
    `lexiro:flow-draft:v1:${uid ?? "local"}:manual-set:${initialFolderId ?? UNCATEGORIZED_FOLDER_ID}`,
    {
      entry: "ask",
      form: { setName: t("setEditor.defaultSetName"), words: [emptyWord] },
    },
  );
  const cancelHref = initialFolderId && initialFolderId !== UNCATEGORIZED_FOLDER_ID
    ? `/library?folderId=${encodeURIComponent(initialFolderId)}`
    : "/library";
  if (saved.status === "checking") return <LoadingState />;
  if (saved.status === "offer" || saved.status === "invalid")
    return (
      <ResumeChoice
        back={<BackControl href={cancelHref} />}
        description={t(saved.status === "invalid" ? "draft.invalidDescription" : "draft.manualSetDescription")}
        invalid={saved.status === "invalid"}
        onRestart={saved.restart}
        onResume={saved.resume}
      />
    );
  return <SetEditorFlow initialFolderId={initialFolderId} draft={saved.draft} update={saved.update} clear={saved.clear} />;
}

function SetEditorFlow({
  initialFolderId,
  draft,
  update,
  clear,
}: {
  initialFolderId?: string;
  draft: SetEditorDraft;
  update: (patch: Partial<SetEditorDraft>) => void;
  clear: () => void;
}) {
  const router = useRouter();
  const { state, status, saveSet } = useLibraryStore();
  const entry = draft.entry;
  const form = useForm<SetFormValues>({
    defaultValues: draft.form,
    resolver: zodResolver(setFormSchema),
  });
  const fields = useFieldArray({ control: form.control, name: "words" });
  useEffect(() => {
    const subscription = form.watch(() => update({ form: form.getValues() }));
    return () => subscription.unsubscribe();
  }, [form, update]);
  const setName = form.watch("setName");
  const errors = form.formState.errors;

  const submit = form.handleSubmit(async (values) => {
    try {
      const saved = await saveSet({
        folderId: initialFolderId ?? UNCATEGORIZED_FOLDER_ID,
        setName: createUniqueSetName(values.setName, state.sets.map((entry) => entry.setName)),
        words: values.words.map((word) => ({
          examples: word.examples.map((value) => value.trim()).filter(Boolean),
          meaningZh: word.meaningZh,
          pos: word.pos,
          supplementary: word.supplementary,
          word: word.word,
        })),
      });
      clear();
      router.push(`/sets/${saved.id}`);
    } catch (reason) {
      form.setError("root", {
        message: t("setEditor.saveFailed", {
          message: reason instanceof Error ? reason.message : String(reason),
        }),
      });
    }
  });

  const homeFolderId = initialFolderId;
  const cancelHref =
    homeFolderId && homeFolderId !== UNCATEGORIZED_FOLDER_ID
      ? `/library?folderId=${encodeURIComponent(homeFolderId)}`
      : "/library";
  const organizeHref = homeFolderId
    ? `/sets/new/organize?folderId=${encodeURIComponent(homeFolderId)}`
    : "/sets/new/organize";

  const metadataFields = (
    <div className="space-y-4">
      <ListSection
        footer={
          errors.setName?.message ??
          (errors.setName ? t("setEditor.required") : undefined)
        }
      >
        <ListInputRow
          label={t("setEditor.name")}
          onChange={(value) =>
            form.setValue("setName", value, { shouldDirty: true })
          }
          placeholder={t("setEditor.namePlaceholder")}
          value={setName}
        />
      </ListSection>
    </div>
  );

  const backLink = <BackControl href={cancelHref} label={t("setEditor.cancel")} />;

  if (entry === "ask") {
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader back={<BackControl href={cancelHref} />} title={t("setEditor.howTitle")} />
        <ChoiceList
          onSelect={(value) => {
            if (value === "ai") router.push(organizeHref);
            else update({ entry: "manual" });
          }}
          options={[
            {
              description: t("setEditor.manualWayHint"),
              icon: Icons.edit,
              label: t("setEditor.manualWay"),
              value: "manual",
            },
            {
              description: t("setEditor.aiWayHint"),
              icon: Icons.generate,
              label: t("setEditor.aiWay"),
              value: "ai",
            },
          ]}
        />
      </div>
    );
  }

  return (
    <form className="mx-auto max-w-3xl" id="new-set-form" onSubmit={submit}>
      <PageHeader
        actions={
          <Button asChild variant="outline">
            <Link href={organizeHref}>
              <Icons.generate />
              {t("setEditor.aiOrganize")}
            </Link>
          </Button>
        }
        back={backLink}
        title={t("setEditor.createTitle")}
      />

      <div>
        {metadataFields}

        <div className="section-gap flex flex-wrap items-center justify-between gap-3">
          <h2 className="type-section">{t("setEditor.words")}</h2>
          <Button
            onClick={() => fields.append(emptyWord)}
            size="sm"
            type="button"
            variant="secondary"
          >
            <Icons.create />
            {t("setEditor.addWord")}
          </Button>
        </div>

        <div className="mt-4 space-y-7">
          {fields.fields.map((field, index) => (
            <SetWordFields
              autoFocus={index === 0}
              form={form}
              index={index}
              key={field.id}
              onAddSense={() =>
                fields.insert(index + 1, {
                  ...emptyWord,
                  word: form.getValues(`words.${index}.word`),
                })
              }
              onRemove={
                fields.fields.length > 1
                  ? () => fields.remove(index)
                  : undefined
              }
            />
          ))}
        </div>

        <StepActions width="wide">
          {errors.root?.message && (
            <p role="alert" className="text-sm text-destructive">
              {errors.root.message}
            </p>
          )}
          <Button
            disabled={form.formState.isSubmitting || status !== "ready"}
            form="new-set-form"
            size="lg"
            type="submit"
          >
            <Icons.success />
            {form.formState.isSubmitting
              ? t("setEditor.saving")
              : t("setEditor.saveWord")}
          </Button>
        </StepActions>
      </div>

    </form>
  );
}

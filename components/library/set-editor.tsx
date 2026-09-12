"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";

import {
  emptyWord,
  getSetWords,
  setFormSchema,
  type SetFormValues,
} from "@/components/library/set-form";
import { SetWordFields } from "@/components/library/set-word-fields";
import { WordCapture } from "@/components/library/word-capture";
import { useUnsavedGuard } from "@/components/library/use-unsaved-guard";
import { BackControl } from "@/components/ui/back-control";
import { Button } from "@/components/ui/button";
import { ChoiceList } from "@/components/ui/choice-list";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  ListInputRow,
  ListPicker,
  ListSection,
} from "@/components/ui/list";
import { Icons } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { t } from "@/lib/i18n";
import { useLibraryStore } from "@/stores/library-store";
import { UNCATEGORIZED_FOLDER_ID } from "@/src/lib/folders";

/**
 * The form, and only the form.
 *
 * Everything a set is worth looking at — how far through it you are, the
 * questions built from it, what it can be exported or deleted into — belongs to
 * the view at `/sets/[setId]`. Editing is the state you step into from there,
 * so this screen holds the fields and the one button that commits them.
 */
export function SetEditor({ initialFolderId }: { initialFolderId?: string }) {
  const router = useRouter();
  const { state, status, saveSet } = useLibraryStore();
  const form = useForm<SetFormValues>({
    defaultValues: {
      folderId: initialFolderId ?? UNCATEGORIZED_FOLDER_ID,
      setName: t("setEditor.defaultSetName"),
      words: [emptyWord],
    },
    resolver: zodResolver(setFormSchema),
  });
  const fields = useFieldArray({ control: form.control, name: "words" });
  // A new set asks how you want to add words before showing either surface, so
  // the typing form and the paste-a-list assistant are never both on screen.
  const [entry, setEntry] = useState<"ask" | "manual" | "assist">("ask");
  const { clearPending, pendingHref } = useUnsavedGuard(form.formState.isDirty);
  const setName = form.watch("setName");
  const folderId = form.watch("folderId");
  const errors = form.formState.errors;

  const submit = form.handleSubmit(async (values) => {
    const defaultName = t("setEditor.defaultSetName").toLocaleLowerCase();
    const defaultSet =
      values.setName.trim().toLocaleLowerCase() === defaultName
        ? state.sets.find(
            (entry) => entry.setName.trim().toLocaleLowerCase() === defaultName,
          )
        : undefined;
    const targetSetId = defaultSet?.id;
    if (
      state.sets.some(
        (entry) =>
          entry.id !== targetSetId &&
          entry.setName.trim().toLocaleLowerCase() ===
            values.setName.trim().toLocaleLowerCase(),
      )
    ) {
      form.setError("setName", { message: t("setEditor.duplicateName") });
      return;
    }

    const words = defaultSet
      ? [...getSetWords(state, defaultSet.id), ...values.words]
      : values.words;
    const saved = await saveSet({
      folderId:
        defaultSet && values.folderId === UNCATEGORIZED_FOLDER_ID
          ? defaultSet.folderId
          : values.folderId,
      id: targetSetId,
      setName: values.setName,
      words: words.map((word) => ({
        examples: word.examples.map((value) => value.trim()).filter(Boolean),
        meaningZh: word.meaningZh,
        pos: word.pos,
        word: word.word,
      })),
    });
    router.push(`/sets/${saved.id}`);
  });

  // Editing is a state you stepped into from the set's own page, so leaving it
  // returns there. A new set has no page yet, so it returns to the folder it
  // was started from.
  const homeFolderId = initialFolderId;
  const cancelHref =
    homeFolderId && homeFolderId !== UNCATEGORIZED_FOLDER_ID
      ? `/library?folderId=${encodeURIComponent(homeFolderId)}`
      : "/library";

  const metadataFields = (
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
      <ListPicker
        label={t("setEditor.folder")}
        onChange={(value) =>
          form.setValue("folderId", value, { shouldDirty: true })
        }
        options={[
          { label: t("library.uncategorized"), value: UNCATEGORIZED_FOLDER_ID },
          ...state.folders
            .filter((folder) => folder.id !== UNCATEGORIZED_FOLDER_ID)
            .map((folder) => ({ label: folder.name, value: folder.id })),
        ]}
        value={folderId}
      />
    </ListSection>
  );

  const backLink = (
    <BackControl allowDiscard href={cancelHref} label={t("setEditor.cancel")} />
  );

  if (entry === "ask") {
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader back={backLink} title={t("setEditor.howTitle")} />
        <ChoiceList
          onSelect={(value) => setEntry(value as "manual" | "assist")}
          options={[
            {
              description: t("setEditor.manualWayHint"),
              icon: Icons.edit,
              label: t("setEditor.manualWay"),
              value: "manual",
            },
            {
              description: t("setEditor.assistWayHint"),
              icon: Icons.generate,
              label: t("setEditor.assistWay"),
              value: "assist",
            },
          ]}
        />
      </div>
    );
  }

  if (entry === "assist") {
    return (
      <WordCapture
        back={<BackControl onClick={() => setEntry("ask")} />}
        initialFolderId={initialFolderId}
        onSwitchToManual={() => setEntry("manual")}
      />
    );
  }

  return (
    <form className="mx-auto max-w-3xl" onSubmit={submit}>
      <PageHeader back={backLink} title={t("setEditor.createTitle")} />

      <div>
        <details className="group rounded-[var(--radius-card)] border px-4 py-3.5 open:bg-[var(--surface-inset)] sm:px-5">
          <summary className="cursor-pointer list-none text-sm font-medium marker:content-none">
            <span className="flex items-center justify-between gap-3">
              <span>
                {t("setEditor.organizationSummary", {
                  name: setName || t("setEditor.defaultSetName"),
                })}
              </span>
              <span className="text-xs text-muted-foreground group-open:hidden">
                {t("setEditor.organize")}
              </span>
            </span>
          </summary>
          <div className="mt-5 rule-t pt-5">{metadataFields}</div>
        </details>

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

        <p className="mt-4">
          <button
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            onClick={() => setEntry("assist")}
            type="button"
          >
            {t("setEditor.switchToAssist")}
          </button>
        </p>

        <div className="mt-7 flex justify-end">
          <Button
            className="w-full sm:w-auto"
            disabled={form.formState.isSubmitting || status !== "ready"}
            size="lg"
            type="submit"
          >
            <Icons.success />
            {form.formState.isSubmitting
              ? t("setEditor.saving")
              : t("setEditor.saveWord")}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        confirmLabel={t("setEditor.discard")}
        description={t("setEditor.unsavedDescription")}
        onConfirm={() => {
          const href = pendingHref;
          clearPending();
          router.push(href);
        }}
        onOpenChange={(open) => {
          if (!open) clearPending();
        }}
        open={Boolean(pendingHref)}
        title={t("setEditor.unsavedTitle")}
        tone="default"
      />
    </form>
  );
}

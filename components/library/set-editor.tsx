"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";

import {
  emptyWord,
  getSetWords,
  setFormSchema,
  type SetFormValues,
} from "@/components/library/set-form";
import { SetFolderPicker } from "@/components/library/set-folder-picker";
import { SetWordFields } from "@/components/library/set-word-fields";
import { useUnsavedGuard } from "@/components/library/use-unsaved-guard";
import { BackControl } from "@/components/ui/back-control";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ListInputRow, ListSection } from "@/components/ui/list";
import { Icons } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { StepActions } from "@/components/ui/step-actions";
import { t } from "@/lib/i18n";
import { useLibraryStore } from "@/stores/library-store";
import { UNCATEGORIZED_FOLDER_ID } from "@/src/lib/folders";

/** New sets open on the manual form; AI organization is one header action away. */
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
        supplementary: word.supplementary,
        word: word.word,
      })),
    });
    router.push(`/sets/${saved.id}`);
  });

  // A new set has no page yet, so leaving returns to its starting folder.
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
      <SetFolderPicker
        folders={state.folders}
        onChange={(value) =>
          form.setValue("folderId", value, { shouldDirty: true })
        }
        value={folderId}
      />
    </div>
  );

  const backLink = (
    <BackControl allowDiscard href={cancelHref} label={t("setEditor.cancel")} />
  );

  return (
    <form className="mx-auto max-w-3xl" onSubmit={submit}>
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
          <Button
            disabled={form.formState.isSubmitting || status !== "ready"}
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

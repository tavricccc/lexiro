"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";

import {
  emptyWord,
  getSetWords,
  setFormSchema,
  type SetFormValues,
} from "@/components/library/set-form";
import { SetWordFields } from "@/components/library/set-word-fields";
import { WordAssistant } from "@/components/library/word-assistant";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, FieldRow } from "@/components/ui/field";
import { Icons } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { SelectField } from "@/components/ui/select-field";
import { t } from "@/lib/i18n";
import { useLearningStore } from "@/stores/learning-store";
import { useLibraryStore } from "@/stores/library-store";
import { UNCATEGORIZED_FOLDER_ID } from "@/src/lib/folders";
import {
  asSenseId,
  buildSenseId,
  normalizePartOfSpeech,
  normalizeWordKey,
} from "@/src/lib/library";

export function SetEditor({
  setId,
  initialFolderId,
}: {
  setId?: string;
  initialFolderId?: string;
}) {
  const router = useRouter();
  const { state, status, saveSet } = useLibraryStore();
  const current = setId
    ? state.sets.find((entry) => entry.id === setId)
    : undefined;
  const form = useForm<SetFormValues>({
    defaultValues: {
      folderId: initialFolderId ?? UNCATEGORIZED_FOLDER_ID,
      setName: setId ? "" : t("setEditor.defaultSetName"),
      words: [emptyWord],
    },
    resolver: zodResolver(setFormSchema),
  });
  const fields = useFieldArray({ control: form.control, name: "words" });
  const [showAssistant, setShowAssistant] = useState(false);
  const [pendingHref, setPendingHref] = useState("");
  const setName = form.watch("setName");
  const folderId = form.watch("folderId");
  const errors = form.formState.errors;

  useEffect(() => {
    if (!current) return;
    const words = getSetWords(state, current.id);
    form.reset({
      folderId: current.folderId,
      setName: current.setName,
      words: words.length ? words : [emptyWord],
    });
  }, [current, form, state.memberships, state.words]);

  useEffect(() => {
    const protect = (event: BeforeUnloadEvent) => {
      if (!form.formState.isDirty) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [form.formState.isDirty]);

  useEffect(() => {
    // In-app navigation away from a dirty form goes through the discard dialog.
    const intercept = (event: MouseEvent) => {
      if (!form.formState.isDirty || event.defaultPrevented || event.button !== 0)
        return;
      const anchor = (event.target as Element | null)?.closest(
        "a[href]",
      ) as HTMLAnchorElement | null;
      if (
        !anchor ||
        anchor.dataset.allowDiscard === "true" ||
        anchor.origin !== window.location.origin
      )
        return;
      event.preventDefault();
      setPendingHref(`${anchor.pathname}${anchor.search}${anchor.hash}`);
    };
    document.addEventListener("click", intercept, true);
    return () => document.removeEventListener("click", intercept, true);
  }, [form.formState.isDirty]);

  const submit = form.handleSubmit(async (values) => {
    const defaultName = t("setEditor.defaultSetName").toLocaleLowerCase();
    const defaultSet =
      !setId && values.setName.trim().toLocaleLowerCase() === defaultName
        ? state.sets.find(
            (entry) =>
              entry.setName.trim().toLocaleLowerCase() === defaultName,
          )
        : undefined;
    const targetSetId = setId ?? defaultSet?.id;
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

    const remaps = values.words.flatMap((word) => {
      if (!word.originalWordKey || !word.originalSenseId) return [];
      const newWordKey = normalizeWordKey(word.word);
      const pos = normalizePartOfSpeech(word.pos) || word.pos.trim();
      const newSenseId = buildSenseId(newWordKey, pos, word.meaningZh.trim());
      if (
        word.originalWordKey === newWordKey &&
        word.originalSenseId === newSenseId
      )
        return [];
      return [
        {
          newSenseId,
          newWordKey,
          // Both came out of the Library through the form, which types every
          // field as a plain string.
          oldSenseId: asSenseId(word.originalSenseId),
          oldWordKey: normalizeWordKey(word.originalWordKey),
        },
      ];
    });
    const words = defaultSet
      ? [...getSetWords(state, defaultSet.id), ...values.words]
      : values.words;
    const saved = await saveSet({
      folderId:
        defaultSet && values.folderId === UNCATEGORIZED_FOLDER_ID
          ? defaultSet.folderId
          : values.folderId,
      id: targetSetId,
      remaps,
      setName: values.setName,
      words: words.map((word) => ({
        examples: word.example
          .split(/\r?\n/)
          .map((value) => value.trim())
          .filter(Boolean),
        meaningZh: word.meaningZh,
        pos: word.pos,
        word: word.word,
      })),
    });
    if (remaps.length) await useLearningStore.getState().remapSenses(remaps);
    router.push(`/sets/${saved.id}`);
  });

  const metadataFields = (
    <FieldRow className="sm:grid-cols-[minmax(0,1fr)_14rem]">
      <Field
        error={
          errors.setName?.message ?? (errors.setName && t("setEditor.required"))
        }
        label={t("setEditor.name")}
      >
        <Input
          {...form.register("setName")}
          placeholder={t("setEditor.namePlaceholder")}
        />
      </Field>
      <SelectField
        label={t("setEditor.folder")}
        onValueChange={(value) =>
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
    </FieldRow>
  );

  return (
    <form className="mx-auto max-w-3xl" onSubmit={submit}>
      <PageHeader
        back={
          <Button asChild size="sm" variant="ghost">
            <Link
              data-allow-discard="true"
              href={
                setId
                  ? `/sets/${setId}`
                  : initialFolderId
                    ? `/library?folderId=${encodeURIComponent(initialFolderId)}`
                    : "/library"
              }
            >
              <Icons.back />
              {t("setEditor.cancel")}
            </Link>
          </Button>
        }
        description={setId ? undefined : t("setEditor.quickDescription")}
        title={t(setId ? "setEditor.editTitle" : "setEditor.createTitle")}
      />

      <div>
        {setId ? (
          metadataFields
        ) : (
          // A first set only needs a word; naming and filing stay folded away.
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
            <div className="mt-5 border-t pt-5">{metadataFields}</div>
          </details>
        )}

        <div className="section-gap flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-lexical text-xl font-medium">
            {t("setEditor.words")}
          </h2>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => setShowAssistant((value) => !value)}
              size="sm"
              type="button"
              variant="ghost"
            >
              <Icons.generate />
              {t("setEditor.aiAssist")}
            </Button>
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
        </div>

        {showAssistant && (
          <WordAssistant
            onApply={(rows) => {
              const currentRows = form.getValues("words");
              const firstIsEmpty =
                currentRows.length === 1 &&
                !currentRows[0].word &&
                !currentRows[0].meaningZh;
              const normalized = rows.map((row) => ({
                ...row,
                originalSenseId: "",
                originalWordKey: "",
              }));
              if (firstIsEmpty) fields.replace(normalized);
              else fields.append(normalized);
            }}
            onClose={() => setShowAssistant(false)}
          />
        )}

        <div className="mt-4 divide-y border-y">
          {fields.fields.map((field, index) => (
            <SetWordFields
              autoFocus={!setId && index === 0}
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
                fields.fields.length > 1 ? () => fields.remove(index) : undefined
              }
            />
          ))}
        </div>

        <div className="sticky bottom-[max(0.75rem,var(--safe-bottom))] z-20 -mx-2 mt-7 flex justify-end rounded-[var(--radius-stage)] bg-background/88 p-2 shadow-[var(--shadow-floating)] backdrop-blur-xl sm:mx-0 sm:bg-transparent sm:p-0 sm:shadow-none sm:backdrop-blur-none">
          <Button
            className="w-full sm:w-auto"
            disabled={form.formState.isSubmitting || status !== "ready"}
            size="lg"
            type="submit"
          >
            <Icons.success />
            {form.formState.isSubmitting
              ? t("setEditor.saving")
              : t(setId ? "setEditor.save" : "setEditor.saveWord")}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        confirmLabel={t("setEditor.discard")}
        description={t("setEditor.unsavedDescription")}
        onConfirm={() => {
          const href = pendingHref;
          setPendingHref("");
          router.push(href);
        }}
        onOpenChange={(open) => {
          if (!open) setPendingHref("");
        }}
        open={Boolean(pendingHref)}
        title={t("setEditor.unsavedTitle")}
        tone="default"
      />
    </form>
  );
}

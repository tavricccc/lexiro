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
import { useUnsavedGuard } from "@/components/library/use-unsaved-guard";
import {
  WordAssistant,
  type AssistedWordRow,
} from "@/components/library/word-assistant";
import { Button } from "@/components/ui/button";
import { ChoiceList } from "@/components/ui/choice-list";
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

/**
 * The form, and only the form.
 *
 * Everything a set is worth looking at — how far through it you are, the
 * questions built from it, what it can be exported or deleted into — belongs to
 * the view at `/sets/[setId]`. Editing is the state you step into from there,
 * so this screen holds the fields and the one button that commits them.
 */
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
  // A new set asks how you want to add words before showing either surface, so
  // the typing form and the paste-a-list assistant are never both on screen.
  const [entry, setEntry] = useState<"ask" | "manual" | "assist">(
    setId ? "manual" : "ask",
  );
  const { clearPending, pendingHref } = useUnsavedGuard(form.formState.isDirty);
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

  // Editing is a state you stepped into from the set's own page, so leaving it
  // returns there. A new set has no page yet, so it returns to the folder it
  // was started from.
  const homeFolderId = current?.folderId ?? initialFolderId;
  const cancelHref = setId
    ? `/sets/${setId}`
    : homeFolderId && homeFolderId !== UNCATEGORIZED_FOLDER_ID
      ? `/library?folderId=${encodeURIComponent(homeFolderId)}`
      : "/library";

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

  const backLink = (
    <Button asChild size="sm" variant="ghost">
      <Link data-allow-discard="true" href={cancelHref}>
        <Icons.back />
        {t(setId ? "setEditor.backToSet" : "setEditor.cancel")}
      </Link>
    </Button>
  );

  const applyAssisted = (rows: AssistedWordRow[]) => {
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
    setEntry("manual");
  };

  if (entry === "ask") {
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader
          back={backLink}
          description={t("setEditor.howHint")}
          title={t("setEditor.howTitle")}
        />
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
      <div className="mx-auto max-w-3xl">
        <PageHeader
          back={
            <Button
              onClick={() => setEntry(setId ? "manual" : "ask")}
              size="sm"
              type="button"
              variant="ghost"
            >
              <Icons.back />
              {t("common.back")}
            </Button>
          }
          description={t("setEditor.aiAssistDescription")}
          title={t("setEditor.aiAssist")}
        />
        <WordAssistant onApply={applyAssisted} />
        <p className="mt-6">
          <button
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            onClick={() => setEntry("manual")}
            type="button"
          >
            {t("setEditor.switchToManual")}
          </button>
        </p>
      </div>
    );
  }

  return (
    <form className="mx-auto max-w-3xl" onSubmit={submit}>
      <PageHeader
        back={backLink}
        description={setId ? undefined : t("setEditor.quickDescription")}
        title={current ? current.setName : t("setEditor.createTitle")}
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
            <div className="mt-5 rule-t pt-5">{metadataFields}</div>
          </details>
        )}

        <div className="section-gap flex flex-wrap items-center justify-between gap-3">
          <h2 className="type-section">
            {t("setEditor.words")}
          </h2>
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

        <div className="mt-4 rule-card rule-list">
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

        {!setId && (
          <p className="mt-4">
            <button
              className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              onClick={() => setEntry("assist")}
              type="button"
            >
              {t("setEditor.switchToAssist")}
            </button>
          </p>
        )}

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

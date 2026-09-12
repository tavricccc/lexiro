"use client";

import type { UseFormReturn } from "react-hook-form";

import type { SetFormValues } from "@/components/library/set-form";
import {
  ListActionRow,
  ListInputRow,
  ListSection,
} from "@/components/ui/list";
import { ExampleFields } from "@/components/library/example-fields";
import { t } from "@/lib/i18n";

/**
 * One word of the set being written, as its own group.
 *
 * It used to be a two-column grid of labelled boxes, which on a phone became a
 * column of boxes with captions — a web form. A word is a handful of short
 * values, so each one is a line: what it is on the left, what you typed on the
 * right, and the sentences under their own labels because a sentence needs the
 * width.
 */
export function SetWordFields({
  autoFocus,
  form,
  index,
  onAddSense,
  onRemove,
}: {
  autoFocus: boolean;
  form: UseFormReturn<SetFormValues>;
  index: number;
  onAddSense: () => void;
  onRemove?: () => void;
}) {
  const errors = form.formState.errors.words?.[index];
  const set = (field: "word" | "pos" | "meaningZh", value: string) =>
    form.setValue(`words.${index}.${field}`, value, { shouldDirty: true });
  const missing = errors?.word || errors?.pos || errors?.meaningZh;

  return (
    <ListSection
      footer={missing ? t("setEditor.required") : undefined}
      header={t("setEditor.wordNumber", { count: index + 1 })}
    >
      <ListInputRow
        autoFocus={autoFocus}
        label={t("setEditor.word")}
        onChange={(value) => set("word", value)}
        placeholder={t("setEditor.wordPlaceholder")}
        value={form.watch(`words.${index}.word`)}
      />
      <ListInputRow
        label={t("setEditor.pos")}
        onChange={(value) => set("pos", value)}
        placeholder={t("setEditor.posPlaceholder")}
        value={form.watch(`words.${index}.pos`)}
      />
      <ListInputRow
        label={t("setEditor.meaning")}
        onChange={(value) => set("meaningZh", value)}
        placeholder={t("setEditor.meaningPlaceholder")}
        value={form.watch(`words.${index}.meaningZh`)}
      />
      <ExampleFields
        onChange={(examples) =>
          form.setValue(`words.${index}.examples`, examples, {
            shouldDirty: true,
          })
        }
        values={form.watch(`words.${index}.examples`)}
      />
      <ListActionRow onClick={onAddSense}>
        {t("setEditor.addSense")}
      </ListActionRow>
      {onRemove && (
        <ListActionRow onClick={onRemove} tone="destructive">
          {t("setEditor.removeWord")}
        </ListActionRow>
      )}
    </ListSection>
  );
}

"use client";

import type { UseFormReturn } from "react-hook-form";

import type { SetFormValues } from "@/components/library/set-form";
import { Button } from "@/components/ui/button";
import { Field, FieldRow } from "@/components/ui/field";
import { Icons } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { ExampleFields } from "@/components/library/example-fields";
import { t } from "@/lib/i18n";

/**
 * One word row of the set editor. The margin numeral echoes the sense counter
 * in a dictionary entry, so the editor and the finished entry read the same way.
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

  return (
    <section className="grid gap-x-4 py-6 sm:grid-cols-[1.75rem_minmax(0,1fr)]">
      <span
        aria-hidden
        className="hidden pt-8 text-sm tabular-nums text-brand-500 sm:block"
      >
        {index + 1}
      </span>

      <div>
        <FieldRow className="sm:grid-cols-[minmax(0,22rem)_9rem]">
          <Field
            error={errors?.word && t("setEditor.required")}
            label={t("setEditor.word")}
          >
            <Input
              autoFocus={autoFocus}
              {...form.register(`words.${index}.word`)}
              placeholder={t("setEditor.wordPlaceholder")}
            />
          </Field>
          <Field
            error={errors?.pos && t("setEditor.required")}
            label={t("setEditor.pos")}
          >
            <Input
              {...form.register(`words.${index}.pos`)}
              placeholder={t("setEditor.posPlaceholder")}
            />
          </Field>
        </FieldRow>

        <FieldRow className="mt-4">
          <Field
            error={errors?.meaningZh && t("setEditor.required")}
            label={t("setEditor.meaning")}
          >
            <Input
              {...form.register(`words.${index}.meaningZh`)}
              placeholder={t("setEditor.meaningPlaceholder")}
            />
          </Field>
          <ExampleFields
            values={form.watch(`words.${index}.examples`)}
            onChange={(examples) =>
              form.setValue(`words.${index}.examples`, examples, {
                shouldDirty: true,
              })
            }
          />
        </FieldRow>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={onAddSense} size="sm" type="button" variant="ghost">
            <Icons.create />
            {t("setEditor.addSense")}
          </Button>
          {onRemove && (
            <Button
              className="text-muted-foreground hover:text-destructive"
              onClick={onRemove}
              size="sm"
              type="button"
              variant="ghost"
            >
              <Icons.delete />
              {t("setEditor.removeWord")}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

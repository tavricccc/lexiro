"use client";
import { useState } from "react";
import type { WordDraft } from "@/types";
import { ExampleFields } from "@/components/library/example-fields";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Icons } from "@/components/ui/icons";
import { t } from "@/lib/i18n";

export function WordEditor({
  value,
  onSave,
  onCancel,
}: {
  value: WordDraft;
  onSave: (value: WordDraft) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(() => structuredClone(value));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const updateSense = (
    index: number,
    patch: Partial<WordDraft["senses"][number]>,
  ) =>
    setDraft((current) => ({
      ...current,
      senses: current.senses.map((sense, i) =>
        i === index ? { ...sense, ...patch } : sense,
      ),
    }));
  const save = async () => {
    if (
      !draft.word.trim() ||
      !draft.senses.length ||
      draft.senses.some((sense) => !sense.pos.trim() || !sense.meaning.trim())
    ) {
      setError(t("setEditor.required"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onSave(draft);
    } catch {
      setError(t("wordEdit.saveFailed"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      <Field label={t("setEditor.word")}>
        <Input
          value={draft.word}
          disabled={busy}
          onChange={(event) => setDraft({ ...draft, word: event.target.value })}
        />
      </Field>
      {draft.senses.map((sense, index) => (
        <fieldset
          key={sense.id}
          disabled={busy}
          className="space-y-3 rounded-xl bg-[var(--surface-inset)] p-3"
        >
          <legend className="text-xs text-muted-foreground">
            {t("wordEdit.sense", { count: index + 1 })}
          </legend>
          <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3">
            <Field label={t("setEditor.pos")}>
              <Input
                value={sense.pos}
                onChange={(event) =>
                  updateSense(index, { pos: event.target.value })
                }
              />
            </Field>
            <Field label={t("setEditor.meaning")}>
              <Input
                value={sense.meaning}
                onChange={(event) =>
                  updateSense(index, { meaning: event.target.value })
                }
              />
            </Field>
          </div>
          <ExampleFields
            values={sense.examples}
            onChange={(examples) => updateSense(index, { examples })}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={draft.senses.length === 1}
              onClick={() =>
                setDraft({
                  ...draft,
                  senses: draft.senses.filter((_, i) => i !== index),
                })
              }
            >
              {t("wordEdit.removeSense")}
            </Button>
          </div>
        </fieldset>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={busy}
        onClick={() =>
          setDraft({
            ...draft,
            senses: [
              ...draft.senses,
              { id: crypto.randomUUID(), pos: "", meaning: "", examples: [""] },
            ],
          })
        }
      >
        <Icons.create />
        {t("wordEdit.addSense")}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="button" disabled={busy} onClick={() => void save()}>
          {t("wordEdit.save")}
        </Button>
        <Button
          type="button"
          disabled={busy}
          variant="ghost"
          onClick={onCancel}
        >
          {t("setEditor.cancel")}
        </Button>
      </div>
    </div>
  );
}

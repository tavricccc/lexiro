"use client";
import { useState } from "react";
import type { WordDraft } from "@/types";
import { ExampleFields } from "@/components/library/example-fields";
import { Button } from "@/components/ui/button";
import {
  ListActionRow,
  ListInputRow,
  ListSection,
} from "@/components/ui/list";
import { t } from "@/lib/i18n";

/**
 * One word, as a grouped list rather than a form.
 *
 * The headword is a group, each sense is a group, and what you can do to a
 * sense — add an example, remove it — are rows of that group instead of a strip
 * of small buttons under it. Saving is the one full-width button at the end;
 * cancelling is the quiet row under it, not its equal beside it.
 */
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
    <div className="space-y-7">
      <ListSection>
        <ListInputRow
          disabled={busy}
          label={t("setEditor.word")}
          onChange={(word) => setDraft({ ...draft, word })}
          value={draft.word}
        />
      </ListSection>

      {draft.senses.map((sense, index) => (
        <ListSection
          header={t("wordEdit.sense", { count: index + 1 })}
          key={sense.id}
        >
          <ListInputRow
            disabled={busy}
            label={t("setEditor.pos")}
            onChange={(pos) => updateSense(index, { pos })}
            value={sense.pos}
          />
          <ListInputRow
            disabled={busy}
            label={t("setEditor.meaning")}
            onChange={(meaning) => updateSense(index, { meaning })}
            value={sense.meaning}
          />
          <ExampleFields
            onChange={(examples) => updateSense(index, { examples })}
            values={sense.examples}
          />
          {draft.senses.length > 1 && (
            <ListActionRow
              disabled={busy}
              onClick={() =>
                setDraft({
                  ...draft,
                  senses: draft.senses.filter((_, i) => i !== index),
                })
              }
              tone="destructive"
            >
              {t("wordEdit.removeSense")}
            </ListActionRow>
          )}
        </ListSection>
      ))}

      <ListSection>
        <ListActionRow
          disabled={busy}
          onClick={() =>
            setDraft({
              ...draft,
              senses: [
                ...draft.senses,
                {
                  id: crypto.randomUUID(),
                  pos: "",
                  meaning: "",
                  examples: [""],
                },
              ],
            })
          }
        >
          {t("wordEdit.addSense")}
        </ListActionRow>
      </ListSection>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="space-y-4">
        <Button
          className="w-full"
          disabled={busy}
          onClick={() => void save()}
          size="lg"
          type="button"
        >
          {t("wordEdit.save")}
        </Button>
        <ListSection>
          <ListActionRow disabled={busy} onClick={onCancel}>
            {t("setEditor.cancel")}
          </ListActionRow>
        </ListSection>
      </div>
    </div>
  );
}

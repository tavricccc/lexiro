"use client";
import { useEffect, useRef, useState } from "react";
import type { WordDraft } from "@/types";
import { ExampleFields } from "@/components/library/example-fields";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { StepActions } from "@/components/ui/step-actions";
import { ListActionRow, ListInputRow, ListSection } from "@/components/ui/list";
import { t } from "@/lib/i18n";

/**
 * One word, as a grouped list rather than a form.
 *
 * The headword is a group, each sense is a group, and what you can do to a
 * sense — add an example, remove it — are rows of that group instead of a strip
 * of small buttons under it. Saving and cancelling stay on the shared bottom
 * action surface, so a long list of senses never hides the way forward.
 */
export function WordEditor({
  value,
  initialDraft,
  cancelLabel,
  onDraftChange,
  onSave,
  onCancel,
}: {
  value: WordDraft;
  initialDraft?: WordDraft;
  cancelLabel?: string;
  onDraftChange?: (draft: WordDraft) => void;
  onSave: (value: WordDraft) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(() =>
    structuredClone(initialDraft ?? value),
  );
  const onDraftRef = useRef(onDraftChange);
  onDraftRef.current = onDraftChange;
  const firstDraft = useRef(true);
  useEffect(() => {
    if (firstDraft.current) {
      firstDraft.current = false;
      return;
    }
    setError("");
    onDraftRef.current?.(draft);
  }, [draft]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const firstMissing = !draft.word.trim()
    ? "word"
    : draft.senses.length === 0
      ? null
      : (draft.senses.flatMap((sense, index) => [
          ...(!sense.pos.trim() ? [`senses.${index}.pos`] : []),
          ...(!sense.meaning.trim() ? [`senses.${index}.meaning`] : []),
        ])[0] ?? null);
  const incomplete = Boolean(firstMissing || !draft.senses.length);
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
    setSubmitted(true);
    if (incomplete) {
      const field = firstMissing
        ? contentRef.current?.querySelector<HTMLInputElement>(
            `input[name="${firstMissing}"]`,
          )
        : null;
      field?.focus({ preventScroll: true });
      field?.scrollIntoView({ block: "center", behavior: "smooth" });
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
    <div className="space-y-7" ref={contentRef}>
      <ListSection>
        <ListInputRow
          disabled={busy}
          invalid={submitted && !draft.word.trim()}
          label={t("setEditor.word")}
          name="word"
          onChange={(word) => setDraft({ ...draft, word })}
          value={draft.word}
        />
      </ListSection>

      {draft.senses.map((sense, index) => (
        <ListSection
          footer={
            sense.supplementary ? t("wordEdit.supplementaryHint") : undefined
          }
          header={t("wordEdit.sense", { count: index + 1 })}
          key={sense.id}
        >
          <ListInputRow
            disabled={busy}
            invalid={submitted && !sense.pos.trim()}
            label={t("setEditor.pos")}
            name={`senses.${index}.pos`}
            onChange={(pos) => updateSense(index, { pos })}
            value={sense.pos}
          />
          <ListInputRow
            disabled={busy}
            invalid={submitted && !sense.meaning.trim()}
            label={t("setEditor.meaning")}
            name={`senses.${index}.meaning`}
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
                  supplementary: false,
                },
              ],
            })
          }
        >
          {t("wordEdit.addSense")}
        </ListActionRow>
      </ListSection>

      <StepActions>
        {submitted && incomplete && (
          <p className="text-sm text-destructive" role="alert">
            {t("wordEdit.fixErrors")}
          </p>
        )}
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <Button
          className="w-full"
          disabled={busy}
          onClick={() => void save()}
          size="lg"
          type="button"
        >
          <Icons.success />
          {t("wordEdit.save")}
        </Button>
        <Button
          disabled={busy}
          onClick={onCancel}
          type="button"
          variant="ghost"
        >
          <Icons.cancel />
          {cancelLabel ?? t("setEditor.cancel")}
        </Button>
      </StepActions>
    </div>
  );
}

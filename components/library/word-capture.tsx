"use client";

import { useState } from "react";
import { toast } from "sonner";

import { getSetWords } from "@/components/library/set-form";
import {
  WordAssistant,
  type AssistedWordRow,
} from "@/components/library/word-assistant";
import { Field } from "@/components/ui/field";
import { FinishPanel } from "@/components/ui/finish-panel";
import { Icons } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { t } from "@/lib/i18n";
import { useLibraryStore } from "@/stores/library-store";

function toDrafts(rows: AssistedWordRow[]) {
  return rows.map((row) => ({
    examples: row.example
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter(Boolean),
    meaningZh: row.meaningZh,
    pos: row.pos,
    word: row.word,
  }));
}

/**
 * Pasting a list and letting AI organize it now ends in the library, not in a
 * form.
 *
 * What the AI returns used to be poured into the set editor, where the user had
 * to press 儲存 to make it real — a confirmation of rows they had not written
 * and would not read line by line. The rows are saved as soon as they validate,
 * and the only thing the flow asks for beforehand is what to call the set.
 *
 * Afterwards there are two ways on, because there are two intentions: this was
 * the list, or this was one of several.
 */
export function WordCapture({
  back,
  initialFolderId,
  onSwitchToManual,
  setId,
}: {
  back: React.ReactNode;
  initialFolderId?: string;
  onSwitchToManual: () => void;
  setId?: string;
}) {
  const { state, saveSet } = useLibraryStore();
  const existing = setId
    ? state.sets.find((entry) => entry.id === setId)
    : undefined;
  const [name, setName] = useState(
    existing?.setName ?? t("setEditor.defaultSetName"),
  );
  const [savedId, setSavedId] = useState(setId ?? "");
  const [added, setAdded] = useState(0);
  const [round, setRound] = useState(0);
  const [done, setDone] = useState(false);

  const store = async (rows: AssistedWordRow[]) => {
    const drafts = toDrafts(rows);
    if (!drafts.length) return;
    try {
      // Adding more to a set that already exists means saving it whole, so the
      // rows already in it are read back and carried along.
      const previous = savedId
        ? toDrafts(
            getSetWords(state, savedId).map((row) => ({
              example: row.example,
              meaningZh: row.meaningZh,
              pos: row.pos,
              word: row.word,
            })),
          )
        : [];
      const saved = await saveSet({
        folderId: existing?.folderId ?? initialFolderId,
        id: savedId || undefined,
        setName: savedId ? (existing?.setName ?? name) : name,
        words: [...previous, ...drafts],
      });
      setSavedId(saved.id);
      setAdded((value) => value + drafts.length);
      setDone(true);
    } catch (reason) {
      toast.error(
        t("setEditor.invalidAiResponse", {
          message: reason instanceof Error ? reason.message : String(reason),
        }),
      );
    }
  };

  if (done) {
    return (
      <FinishPanel
        description={t("setEditor.capturedDescription", { name })}
        finishHref={savedId ? `/sets/${savedId}` : "/library"}
        moreIcon={Icons.create}
        moreLabel={t("setEditor.addMore")}
        onMore={() => {
          setRound((value) => value + 1);
          setDone(false);
        }}
        title={t("setEditor.capturedTitle", { count: added })}
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        back={back}
        description={t("setEditor.aiAssistDescription")}
        title={t("setEditor.aiAssist")}
      />

      {!savedId && (
        <div className="mb-5">
          <Field label={t("setEditor.name")}>
            <Input
              onChange={(event) => setName(event.target.value)}
              placeholder={t("setEditor.namePlaceholder")}
              value={name}
            />
          </Field>
        </div>
      )}

      {/* A new round is a new request with a new paste, so the panel starts
          over rather than showing the previous run's progress. */}
      <WordAssistant key={round} onApply={(rows) => void store(rows)} />

      <p className="mt-6">
        <button
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          onClick={onSwitchToManual}
          type="button"
        >
          {t("setEditor.switchToManual")}
        </button>
      </p>
    </div>
  );
}

"use client";
import { useState } from "react";
import { WordEditor } from "@/components/library/word-editor";
import { WordAssistant } from "@/components/library/word-assistant";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { Icons } from "@/components/ui/icons";
import { t } from "@/lib/i18n";
import { setWordDrafts } from "@/src/lib/word-edit";
import { UNCATEGORIZED_FOLDER_ID } from "@/src/lib/folders";
import { useLibraryStore, type WordDraftInput } from "@/stores/library-store";

export function SetTools({ setId }: { setId: string }) {
  const [panel, setPanel] = useState<"metadata" | "manual" | "ai" | null>(null);
  const [error, setError] = useState("");
  const add = async (words: WordDraftInput[]) => {
    const store = useLibraryStore.getState();
    const current = store.state.sets.find((entry) => entry.id === setId);
    if (!current) throw new Error("missing-set");
    await store.saveSet({
      id: setId,
      setName: current.setName,
      folderId: current.folderId,
      words: [...setWordDrafts(store.state, setId), ...words],
    });
    setPanel(null);
  };
  return (
    <div className="mb-5 space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            setError("");
            setPanel(panel === "metadata" ? null : "metadata");
          }}
        >
          <Icons.edit />
          {t("wordEdit.metadata")}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            setError("");
            setPanel(panel === "manual" ? null : "manual");
          }}
        >
          <Icons.create />
          {t("setEditor.addWord")}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            setError("");
            setPanel(panel === "ai" ? null : "ai");
          }}
        >
          <Icons.generate />
          {t("setEditor.aiAssist")}
        </Button>
      </div>
      {panel === "metadata" && (
        <SetMetadata setId={setId} onDone={() => setPanel(null)} />
      )}
      {panel === "manual" && (
        <WordEditor
          value={{
            word: "",
            senses: [{ id: "new", pos: "", meaning: "", examples: [""] }],
          }}
          onCancel={() => setPanel(null)}
          onSave={(draft) =>
            add(
              draft.senses.map((sense) => ({
                word: draft.word,
                pos: sense.pos,
                meaningZh: sense.meaning,
                examples: sense.examples,
              })),
            )
          }
        />
      )}
      {panel === "ai" && (
        <WordAssistant
          onApply={(rows) =>
            add(rows).catch(() => setError(t("wordEdit.saveFailed")))
          }
        />
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function SetMetadata({ setId, onDone }: { setId: string; onDone: () => void }) {
  const state = useLibraryStore((store) => store.state);
  const current = state.sets.find((entry) => entry.id === setId)!;
  const [name, setName] = useState(current.setName);
  const [folder, setFolder] = useState(
    current.folderId || UNCATEGORIZED_FOLDER_ID,
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const store = useLibraryStore.getState();
    if (!name.trim()) {
      setError(t("setEditor.required"));
      return;
    }
    if (
      store.state.sets.some(
        (entry) =>
          entry.id !== setId &&
          entry.setName.toLocaleLowerCase() === name.trim().toLocaleLowerCase(),
      )
    ) {
      setError(t("setEditor.duplicateName"));
      return;
    }
    setBusy(true);
    try {
      await store.saveSet({
        id: setId,
        setName: name,
        folderId: folder,
        words: setWordDrafts(store.state, setId),
      });
      onDone();
    } catch {
      setError(t("wordEdit.saveFailed"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-3">
      <Field label={t("setEditor.name")}>
        <Input
          value={name}
          disabled={busy}
          onChange={(event) => setName(event.target.value)}
        />
      </Field>
      <SelectField
        label={t("setEditor.folder")}
        value={folder}
        onValueChange={setFolder}
        options={state.folders.map((entry) => ({
          label: entry.name,
          value: entry.id,
        }))}
      />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button disabled={busy} onClick={() => void save()}>
          {t("setEditor.save")}
        </Button>
        <Button variant="ghost" disabled={busy} onClick={onDone}>
          {t("setEditor.cancel")}
        </Button>
      </div>
    </div>
  );
}

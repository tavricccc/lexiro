"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { SetFolderPicker } from "@/components/library/set-folder-picker";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Icons } from "@/components/ui/icons";
import { StepActions } from "@/components/ui/step-actions";
import { t } from "@/lib/i18n";
import { UNCATEGORIZED_FOLDER_ID } from "@/src/lib/folders";
import { setWordDrafts } from "@/src/lib/word-edit";
import { useLibraryStore } from "@/stores/library-store";

export function SetMetadata({ setId }: { setId: string }) {
  const router = useRouter();
  const state = useLibraryStore((store) => store.state);
  const current = state.sets.find((entry) => entry.id === setId);
  const [name, setName] = useState(current?.setName ?? "");
  const [folder, setFolder] = useState(
    current?.folderId || UNCATEGORIZED_FOLDER_ID,
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!current) return null;

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
      router.push(`/sets/${setId}`);
    } catch {
      setError(t("wordEdit.saveFailed"));
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Field label={t("setEditor.name")}>
        <Input
          disabled={busy}
          onChange={(event) => setName(event.target.value)}
          value={name}
        />
      </Field>
      <SetFolderPicker
        disabled={busy}
        folders={state.folders}
        onChange={setFolder}
        value={folder}
      />
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <StepActions>
        <Button disabled={busy} onClick={() => void save()} size="lg">
          <Icons.success />
          {t("setEditor.save")}
        </Button>
      </StepActions>
    </div>
  );
}

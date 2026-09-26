"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { useResumableDraft } from "@/components/ai/use-resumable-draft";
import { SetFolderPicker } from "@/components/library/set-folder-picker";
import { Button } from "@/components/ui/button";
import { DraftSaveStatus } from "@/components/ui/draft-save-status";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Icons } from "@/components/ui/icons";
import { LoadingState } from "@/components/ui/page-state";
import { ResumeChoice } from "@/components/ui/resume-choice";
import { StepActions } from "@/components/ui/step-actions";
import { t } from "@/lib/i18n";
import { UNCATEGORIZED_FOLDER_ID } from "@/src/lib/folders";
import { setWordDrafts } from "@/src/lib/word-edit";
import { useCloudStore } from "@/stores/cloud-store";
import { useLibraryStore } from "@/stores/library-store";

export function SetMetadata({ setId }: { setId: string }) {
  const state = useLibraryStore((store) => store.state);
  const current = state.sets.find((entry) => entry.id === setId);
  if (!current) return null;
  return (
    <SetMetadataFlow
      key={`${setId}:${current.updatedAt}`}
      setId={setId}
      revision={current.updatedAt}
      initial={{
        name: current.setName,
        folder: current.folderId || UNCATEGORIZED_FOLDER_ID,
      }}
    />
  );
}

function SetMetadataFlow({
  setId,
  revision,
  initial,
}: {
  setId: string;
  revision: string;
  initial: { name: string; folder: string };
}) {
  const router = useRouter();
  const uid = useCloudStore((store) => store.user?.uid);
  const state = useLibraryStore((store) => store.state);
  const saved = useResumableDraft(
    `lexiro:flow-draft:v1:${uid ?? "local"}:set-metadata:${setId}:${revision}`,
    initial,
  );
  const { name, folder } = saved.draft;
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const save = async () => {
    const store = useLibraryStore.getState();
    if (!name.trim()) {
      setError(t("setEditor.required"));
      nameRef.current?.focus({ preventScroll: true });
      nameRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
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
      saved.clear();
      router.push(`/app/sets/${setId}`);
    } catch {
      setError(t("wordEdit.saveFailed"));
      setBusy(false);
    }
  };

  if (saved.status === "checking") return <LoadingState />;
  if (saved.status === "offer" || saved.status === "invalid")
    return (
      <ResumeChoice
        description={t(
          saved.status === "invalid"
            ? "draft.invalidDescription"
            : "draft.setMetadataDescription",
        )}
        header={false}
        invalid={saved.status === "invalid"}
        onRestart={saved.restart}
        onResume={saved.resume}
      />
    );

  return (
    <div className="space-y-6">
      <DraftSaveStatus status={saved.persistence} />
      <Field label={t("setEditor.name")}>
        <Input
          aria-invalid={Boolean(error && !name.trim()) || undefined}
          disabled={busy}
          onChange={(event) => {
            saved.update({ name: event.target.value });
            setError("");
          }}
          ref={nameRef}
          value={name}
        />
      </Field>
      <SetFolderPicker
        disabled={busy}
        folders={state.folders}
        onChange={(folder) => {
          saved.update({ folder });
          setError("");
        }}
        value={folder}
      />
      <StepActions>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <Button disabled={busy} onClick={() => void save()} size="lg">
          <Icons.success />
          {t(busy ? "setEditor.saving" : "setEditor.save")}
        </Button>
      </StepActions>
    </div>
  );
}

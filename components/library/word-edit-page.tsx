"use client";

import { useRouter } from "next/navigation";

import { useResumableDraft } from "@/components/ai/use-resumable-draft";
import { WordEditor } from "@/components/library/word-editor";
import { DraftSaveStatus } from "@/components/ui/draft-save-status";
import { EmptyState, LoadingState } from "@/components/ui/page-state";
import { ResumeChoice } from "@/components/ui/resume-choice";
import { t } from "@/lib/i18n";
import { prepareWordEdit } from "@/src/lib/word-edit";
import type { WordDraft, WordKey } from "@/types";
import { useCloudStore } from "@/stores/cloud-store";
import { useLearningStore } from "@/stores/learning-store";
import { useLibraryStore } from "@/stores/library-store";

export function WordEditPage({
  setId,
  wordKey,
}: {
  setId: string;
  wordKey: string;
}) {
  const router = useRouter();
  const state = useLibraryStore((store) => store.state);
  const key = wordKey as WordKey;
  const word = state.words[key];
  const membership = (state.memberships[setId] ?? []).find(
    (entry) => entry.wordKey === key,
  );
  const senses = word?.senses.filter((sense) =>
    membership?.senseIds.includes(sense.id),
  );

  if (!word || !membership || !senses?.length) {
    return (
      <EmptyState
        description={t("setDetail.missingWordDescription")}
        title={t("setDetail.missingWord")}
        variant="filtered"
      />
    );
  }

  const value: WordDraft = {
    word: word.word,
    senses: senses.map((sense) => ({
      id: sense.id,
      pos: sense.pos,
      meaning: sense.meaningZh,
      examples: sense.examples,
      supplementary: sense.supplementary,
    })),
  };

  return (
    <WordEditFlow
      setId={setId}
      wordKey={key}
      revision={word.updatedAt}
      value={value}
      onDone={() => router.push(`/app/sets/${setId}`)}
    />
  );
}

function WordEditFlow({
  setId,
  wordKey,
  revision,
  value,
  onDone,
}: {
  setId: string;
  wordKey: WordKey;
  revision: string;
  value: WordDraft;
  onDone: () => void;
}) {
  const uid = useCloudStore((store) => store.user?.uid);
  const saved = useResumableDraft<WordDraft>(
    `lexiro:flow-draft:v1:${uid ?? "local"}:edit-word:${setId}:${wordKey}:${revision}`,
    value,
  );
  if (saved.status === "checking") return <LoadingState />;
  if (saved.status === "offer" || saved.status === "invalid")
    return (
      <ResumeChoice
        description={t(
          saved.status === "invalid"
            ? "draft.invalidDescription"
            : "draft.wordEditDescription",
        )}
        header={false}
        invalid={saved.status === "invalid"}
        onRestart={saved.restart}
        onResume={saved.resume}
      />
    );

  return (
    <div className="space-y-4">
      <DraftSaveStatus status={saved.persistence} />
      <WordEditor
        cancelLabel={t("draft.leave")}
        initialDraft={saved.draft}
        onDraftChange={(draft) => saved.update(draft)}
        onCancel={onDone}
        onSave={async (draft) => {
          const store = useLibraryStore.getState();
          const input = prepareWordEdit(store.state, setId, wordKey, draft);
          await store.saveSet(input);
          if (input.remaps.length)
            await useLearningStore.getState().remapSenses(input.remaps);
          saved.clear();
          onDone();
        }}
        value={value}
      />
    </div>
  );
}

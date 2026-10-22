import { useAppRouter as useRouter } from "@/lib/use-app-router";
import type { WordDraft } from "@/types";

import { WordEditor } from "@/components/library/word-editor";
import { DraftSaveStatus } from "@/components/ui/draft-save-status";
import { LoadingState } from "@/components/ui/page-state";
import { ResumeChoice } from "@/components/ui/resume-choice";
import { t } from "@/lib/i18n";
import type { DraftPersistence } from "@/lib/draft-persistence";
import { useResumableDraft } from "@/lib/use-resumable-draft";
import { setWordDrafts } from "@/src/lib/word-edit";
import { useLibraryStore, type WordDraftInput } from "@/stores/library-store";
import { useCloudStore } from "@/stores/cloud-store";

interface AddWordsDraft {
  manual: WordDraft;
}

const emptyDraft = (): AddWordsDraft => ({
  manual: {
    word: "",
    senses: [
      {
        id: "new",
        pos: "",
        meaning: "",
        examples: [""],
        supplementary: false,
      },
    ],
  },
});

export function SetWordAddition({ setId }: { setId: string }) {
  const uid = useCloudStore((store) => store.user?.uid);
  const saved = useResumableDraft<AddWordsDraft>(
    `lexiro:flow-draft:v1:${uid ?? "local"}:add-words:${setId}`,
    emptyDraft(),
  );
  if (saved.status === "checking") return <LoadingState />;
  if (saved.status === "offer" || saved.status === "invalid")
    return (
      <ResumeChoice
        header={false}
        description={t(
          saved.status === "invalid"
            ? "draft.invalidDescription"
            : "draft.addWordsDescription",
        )}
        invalid={saved.status === "invalid"}
        onRestart={saved.restart}
        onResume={saved.resume}
      />
    );
  return (
    <AddWordsFlow
      setId={setId}
      draft={saved.draft}
      persistence={saved.persistence}
      update={saved.update}
      clear={saved.clear}
    />
  );
}

function AddWordsFlow({
  setId,
  draft,
  persistence,
  update,
  clear,
}: {
  setId: string;
  draft: AddWordsDraft;
  persistence: DraftPersistence;
  update: (patch: Partial<AddWordsDraft>) => void;
  clear: () => void;
}) {
  const router = useRouter();
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
    clear();
    router.push(`/app/sets/${setId}`);
  };

  return (
    <div className="space-y-4">
      <DraftSaveStatus status={persistence} />
      <WordEditor
        initialDraft={draft.manual}
        onDraftChange={(manual) => update({ manual })}
        onCancel={() => {
          clear();
          router.push(`/app/sets/${setId}`);
        }}
        onSave={(draft) =>
          add(
            draft.senses.map((sense) => ({
              word: draft.word,
              pos: sense.pos,
              meaningZh: sense.meaning,
              examples: sense.examples,
              supplementary: sense.supplementary,
            })),
          )
        }
        value={{
          word: "",
          senses: [
            {
              id: "new",
              pos: "",
              meaning: "",
              examples: [""],
              supplementary: false,
            },
          ],
        }}
      />
    </div>
  );
}

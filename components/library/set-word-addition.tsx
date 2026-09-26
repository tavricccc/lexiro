"use client";

import { useRouter } from "next/navigation";
import type { WordDraft } from "@/types";

import { useResumableDraft } from "@/components/ai/use-resumable-draft";
import type { AiGenerationSnapshot } from "@/components/ai/use-ai-generation";
import {
  WordAssistant,
  type AssistantPhase,
} from "@/components/library/word-assistant";
import { WordEditor } from "@/components/library/word-editor";
import {
  InputOrganizer,
  type InputOrganizerDraft,
  type OrganizerPhase,
} from "@/components/library/input-organizer";
import { ListActionRow, ListSection } from "@/components/ui/list";
import { Button } from "@/components/ui/button";
import { DraftSaveStatus } from "@/components/ui/draft-save-status";
import { Icons } from "@/components/ui/icons";
import { LoadingState } from "@/components/ui/page-state";
import { ResumeChoice } from "@/components/ui/resume-choice";
import { t } from "@/lib/i18n";
import type { DraftPersistence } from "@/lib/draft-persistence";
import { setWordDrafts } from "@/src/lib/word-edit";
import { useLibraryStore, type WordDraftInput } from "@/stores/library-store";
import { useCloudStore } from "@/stores/cloud-store";

interface AddWordsDraft {
  mode: "ai" | "manual";
  sources: string;
  phase: AssistantPhase;
  organizerPhase: OrganizerPhase;
  input: InputOrganizerDraft;
  manual: WordDraft;
  run?: AiGenerationSnapshot<WordDraft>;
}

export function SetWordAddition({ setId }: { setId: string }) {
  const uid = useCloudStore((store) => store.user?.uid);
  const saved = useResumableDraft<AddWordsDraft>(
    `lexiro:flow-draft:v1:${uid ?? "local"}:add-words:${setId}`,
    {
      mode: "manual",
      sources: "",
      phase: "run",
      organizerPhase: "input",
      input: { input: "", review: "", addingPhotos: false },
      manual: {
        word: "",
        senses: [{ id: "new", pos: "", meaning: "", examples: [""], supplementary: false }],
      },
    },
  );
  if (saved.status === "checking") return <LoadingState />;
  if (saved.status === "offer" || saved.status === "invalid")
    return (
      <ResumeChoice
        header={false}
        description={t(saved.status === "invalid" ? "draft.invalidDescription" : "draft.addWordsDescription")}
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
  const { mode, sources, phase, organizerPhase } = draft;
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
      <div hidden={mode !== "manual"}>
        <div className="flex justify-end">
          <Button onClick={() => update({ mode: "ai" })} type="button" variant="outline">
            <Icons.generate />
            {t("setEditor.aiOrganize")}
          </Button>
        </div>
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
      {mode === "ai" &&
        (sources ? (
          <>
          <WordAssistant
              initialRun={draft.run}
              onApply={add}
              onPhase={(phase) => update({ phase })}
              onRunChange={(run) => update({ run })}
              phase={phase}
              sources={sources}
            />
            {phase === "run" && (
              <ListSection>
                <ListActionRow onClick={() => update({ sources: "" })}>
                  {t("setEditor.backToSources")}
                </ListActionRow>
              </ListSection>
            )}
          </>
        ) : (
          <>
            <InputOrganizer
              initialDraft={draft.input}
              onDraftChange={(input) => update({ input })}
              onConfirm={(sources) => update({ sources })}
              onPhase={(organizerPhase) => update({ organizerPhase })}
              phase={organizerPhase}
            />
            {organizerPhase === "input" && (
              <ListSection>
                <ListActionRow onClick={() => update({ mode: "manual" })}>
                  {t("setEditor.manualWay")}
                </ListActionRow>
              </ListSection>
            )}
          </>
        ))}
    </div>
  );
}

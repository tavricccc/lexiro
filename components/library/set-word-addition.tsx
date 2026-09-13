"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  WordAssistant,
  type AssistantPhase,
} from "@/components/library/word-assistant";
import { WordEditor } from "@/components/library/word-editor";
import {
  InputOrganizer,
  type OrganizerPhase,
} from "@/components/library/input-organizer";
import { ListActionRow, ListSection } from "@/components/ui/list";
import { t } from "@/lib/i18n";
import { setWordDrafts } from "@/src/lib/word-edit";
import { useLibraryStore, type WordDraftInput } from "@/stores/library-store";

export function SetWordAddition({
  mode,
  setId,
}: {
  mode: "ai" | "manual";
  setId: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [sources, setSources] = useState("");
  const [phase, setPhase] = useState<AssistantPhase>("run");
  const [organizerPhase, setOrganizerPhase] = useState<OrganizerPhase>("input");
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
    router.push(`/sets/${setId}`);
  };

  return (
    <div className="space-y-4">
      {mode === "manual" ? (
        <WordEditor
          onCancel={() => router.push(`/sets/${setId}`)}
          onSave={(draft) =>
            add(
              draft.senses.map((sense) => ({
                word: draft.word,
                pos: sense.pos,
                meaningZh: sense.meaning,
                examples: sense.examples,
                supplementary: sense.supplementary,
              })),
            ).catch(() => setError(t("wordEdit.saveFailed")))
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
      ) : sources ? (
        <>
          <WordAssistant
            onApply={(rows) =>
              add(rows).catch(() => setError(t("wordEdit.saveFailed")))
            }
            onPhase={setPhase}
            phase={phase}
            sources={sources}
          />
          {phase === "run" && (
            <ListSection>
              <ListActionRow onClick={() => setSources("")}>
                {t("setEditor.backToSources")}
              </ListActionRow>
            </ListSection>
          )}
        </>
      ) : (
        <InputOrganizer
          onConfirm={setSources}
          onPhase={setOrganizerPhase}
          phase={organizerPhase}
        />
      )}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

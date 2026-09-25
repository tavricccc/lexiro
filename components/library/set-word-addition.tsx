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
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { t } from "@/lib/i18n";
import { setWordDrafts } from "@/src/lib/word-edit";
import { useLibraryStore, type WordDraftInput } from "@/stores/library-store";

export function SetWordAddition({ setId }: { setId: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"ai" | "manual">("manual");
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
      <div hidden={mode !== "manual"}>
        <div className="flex justify-end">
          <Button onClick={() => setMode("ai")} type="button" variant="outline">
            <Icons.generate />
            {t("setEditor.aiOrganize")}
          </Button>
        </div>
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
      </div>
      {mode === "ai" &&
        (sources ? (
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
          <>
            <InputOrganizer
              onConfirm={setSources}
              onPhase={setOrganizerPhase}
              phase={organizerPhase}
            />
            {organizerPhase === "input" && (
              <ListSection>
                <ListActionRow onClick={() => setMode("manual")}>
                  {t("setEditor.manualWay")}
                </ListActionRow>
              </ListSection>
            )}
          </>
        ))}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

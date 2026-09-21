"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  InputOrganizer,
  type OrganizerPhase,
} from "@/components/library/input-organizer";
import {
  WordAssistant,
  type AssistantPhase,
  type AssistedWordRow,
} from "@/components/library/word-assistant";
import { SetFolderPicker } from "@/components/library/set-folder-picker";
import { BackControl } from "@/components/ui/back-control";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { StepFrame } from "@/components/ui/step-frame";
import { t } from "@/lib/i18n";
import { useLibraryStore } from "@/stores/library-store";
import { UNCATEGORIZED_FOLDER_ID } from "@/src/lib/folders";

type AiSetPhase = OrganizerPhase | AssistantPhase;

/** The complete AI set flow, kept on one route so moving between steps is immediate. */
export function AiSetOrganizer({
  initialFolderId,
}: {
  initialFolderId?: string;
}) {
  const router = useRouter();
  const folders = useLibraryStore((store) => store.state.folders);
  const saveSet = useLibraryStore((store) => store.saveSet);
  const [name, setName] = useState(t("setEditor.defaultSetName"));
  const [folderId, setFolderId] = useState(
    initialFolderId ?? UNCATEGORIZED_FOLDER_ID,
  );
  const [sources, setSources] = useState("");
  const [phase, setPhase] = useState<AiSetPhase>("input");
  const current =
    phase === "input"
      ? 1
      : phase === "review" && !sources
        ? 2
        : phase === "run"
          ? 3
          : 4;
  const newSetHref = initialFolderId
    ? `/sets/new?folderId=${encodeURIComponent(initialFolderId)}`
    : "/sets/new";

  const save = async (rows: AssistedWordRow[]) => {
    const saved = await saveSet({
      folderId,
      setName: name,
      words: rows.map((row) => ({
        examples: row.examples.map((value) => value.trim()).filter(Boolean),
        meaningZh: row.meaningZh,
        pos: row.pos,
        supplementary: row.supplementary,
        word: row.word,
      })),
    });
    router.push(`/sets/${saved.id}`);
  };

  const inputPhase = phase === "input" || (phase === "review" && !sources);
  const title =
    current === 1
      ? t("setEditor.aiAssist")
      : current === 2
        ? t("setEditor.aiListTitle")
        : current === 3
          ? t("setEditor.aiGenerateTitle")
          : t("setEditor.aiReviewTitle");

  return (
    <StepFrame
      {...(current === 1
        ? {
            back: (
              <BackControl href={newSetHref} label={t("setEditor.cancel")} />
            ),
          }
        : current === 2
          ? { onBack: () => setPhase("input") }
          : current === 3
            ? {
                onBack: () => {
                  setSources("");
                  setPhase("review");
                },
              }
            : { onBack: () => setPhase("run") })}
      current={current}
      title={title}
      total={4}
      width="wide"
    >
      {inputPhase ? (
        <>
          {phase === "input" && (
            <div className="space-y-4">
              <Field label={t("setEditor.name")}>
                <Input
                  onChange={(event) => setName(event.target.value)}
                  placeholder={t("setEditor.namePlaceholder")}
                  value={name}
                />
              </Field>
              <SetFolderPicker
                folders={folders}
                onChange={setFolderId}
                value={folderId}
              />
            </div>
          )}
          <div className={phase === "review" ? undefined : "section-gap"}>
            <InputOrganizer
              onConfirm={(value) => {
                setSources(value);
                setPhase("run");
              }}
              onPhase={setPhase}
              phase={phase}
            />
          </div>
        </>
      ) : (
        <WordAssistant
          onApply={save}
          onPhase={setPhase}
          phase={phase as AssistantPhase}
          sources={sources}
        />
      )}
    </StepFrame>
  );
}

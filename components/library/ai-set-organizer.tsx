"use client";

import { useRouter } from "next/navigation";
import type { WordDraft } from "@/types";

import {
  InputOrganizer,
  type InputOrganizerDraft,
  type OrganizerPhase,
} from "@/components/library/input-organizer";
import {
  WordAssistant,
  type AssistantPhase,
  type AssistedWordRow,
} from "@/components/library/word-assistant";
import { useResumableDraft } from "@/components/ai/use-resumable-draft";
import type { AiGenerationSnapshot } from "@/components/ai/use-ai-generation";
import { BackControl } from "@/components/ui/back-control";
import { DraftSaveStatus } from "@/components/ui/draft-save-status";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { StepFrame } from "@/components/ui/step-frame";
import { LoadingState } from "@/components/ui/page-state";
import { ResumeChoice } from "@/components/ui/resume-choice";
import { t } from "@/lib/i18n";
import type { DraftPersistence } from "@/lib/draft-persistence";
import { useLibraryStore } from "@/stores/library-store";
import { useCloudStore } from "@/stores/cloud-store";
import { UNCATEGORIZED_FOLDER_ID } from "@/src/lib/folders";
import { createUniqueSetName } from "@/src/lib/set-name";

type AiSetPhase = OrganizerPhase | AssistantPhase;
interface AiSetDraft {
  name: string;
  sources: string;
  phase: AiSetPhase;
  input: InputOrganizerDraft;
  run?: AiGenerationSnapshot<WordDraft>;
}

/** The complete AI set flow, kept on one route so moving between steps is immediate. */
export function AiSetOrganizer({
  initialFolderId,
}: {
  initialFolderId?: string;
}) {
  const uid = useCloudStore((store) => store.user?.uid);
  const draft = useResumableDraft<AiSetDraft>(
    `lexiro:flow-draft:v1:${uid ?? "local"}:new-set:${initialFolderId ?? UNCATEGORIZED_FOLDER_ID}`,
    {
      name: t("setEditor.defaultSetName"),
      sources: "",
      phase: "input",
      input: { input: "", review: "", addingPhotos: false },
    },
  );
  const newSetHref = initialFolderId
    ? `/app/sets/new?folderId=${encodeURIComponent(initialFolderId)}`
    : "/app/sets/new";
  if (draft.status === "checking") return <LoadingState />;
  if (draft.status === "offer" || draft.status === "invalid")
    return (
      <ResumeChoice
        back={<BackControl href={newSetHref} />}
        description={t(draft.status === "invalid" ? "draft.invalidDescription" : "draft.aiSetDescription")}
        invalid={draft.status === "invalid"}
        onRestart={draft.restart}
        onResume={draft.resume}
      />
    );
  return (
    <AiSetFlow
      initialFolderId={initialFolderId}
      draft={draft.draft}
      persistence={draft.persistence}
      update={draft.update}
      clear={draft.clear}
    />
  );
}

function AiSetFlow({
  initialFolderId,
  draft,
  persistence,
  update,
  clear,
}: {
  initialFolderId?: string;
  draft: AiSetDraft;
  persistence: DraftPersistence;
  update: (patch: Partial<AiSetDraft>) => void;
  clear: () => void;
}) {
  const router = useRouter();
  const sets = useLibraryStore((store) => store.state.sets);
  const saveSet = useLibraryStore((store) => store.saveSet);
  const { name, sources, phase } = draft;
  const current =
    phase === "input"
      ? 1
      : phase === "review" && !sources
        ? 2
        : phase === "run"
          ? 3
          : 4;
  const newSetHref = initialFolderId
    ? `/app/sets/new?folderId=${encodeURIComponent(initialFolderId)}`
    : "/app/sets/new";

  const save = async (rows: AssistedWordRow[]) => {
    const saved = await saveSet({
      folderId: initialFolderId ?? UNCATEGORIZED_FOLDER_ID,
      setName: createUniqueSetName(name, sets.map((entry) => entry.setName)),
      words: rows.map((row) => ({
        examples: row.examples.map((value) => value.trim()).filter(Boolean),
        meaningZh: row.meaningZh,
        pos: row.pos,
        supplementary: row.supplementary,
        word: row.word,
      })),
    });
    clear();
    router.push(`/app/sets/${saved.id}`);
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
          ? { onBack: () => update({ phase: "input" }) }
          : current === 3
            ? {
                onBack: () => {
                  update({ sources: "", phase: "review" });
                },
              }
            : { onBack: () => update({ phase: "run" }) })}
      current={current}
      status={<DraftSaveStatus status={persistence} />}
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
                  onChange={(event) => update({ name: event.target.value })}
                  placeholder={t("setEditor.namePlaceholder")}
                  value={name}
                />
              </Field>
            </div>
          )}
          <div className={phase === "review" ? undefined : "section-gap"}>
            <InputOrganizer
              initialDraft={draft.input}
              onDraftChange={(input) => update({ input })}
              onConfirm={(value) => {
                update({ sources: value, phase: "run" });
              }}
              onPhase={(next) => update({ phase: next })}
              phase={phase}
            />
          </div>
        </>
      ) : (
        <WordAssistant
          initialRun={draft.run}
          onApply={save}
          onPhase={(next) => update({ phase: next })}
          onRunChange={(run) => update({ run })}
          phase={phase as AssistantPhase}
          sources={sources}
        />
      )}
    </StepFrame>
  );
}

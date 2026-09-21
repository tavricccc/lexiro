"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  WordAssistant,
  type AssistantPhase,
  type AssistedWordRow,
} from "@/components/library/word-assistant";
import { BackControl } from "@/components/ui/back-control";
import { ErrorState } from "@/components/ui/page-state";
import { PageHeader } from "@/components/ui/page-header";
import { StepFrame } from "@/components/ui/step-frame";
import {
  clearAiSetDraft,
  readAiSetDraft,
  type AiSetDraft,
} from "@/lib/ai-set-draft";
import { t } from "@/lib/i18n";
import { useLibraryStore } from "@/stores/library-store";

export function AiSetGeneration() {
  const router = useRouter();
  const saveSet = useLibraryStore((store) => store.saveSet);
  const [draft, setDraft] = useState<AiSetDraft | null | undefined>(undefined);
  const [phase, setPhase] = useState<AssistantPhase>("run");
  useEffect(() => setDraft(readAiSetDraft()), []);

  if (draft === undefined) return null;
  if (!draft)
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader
          back={<BackControl href="/sets/new/organize" />}
          title={t("setEditor.aiAssist")}
        />
        <ErrorState error={t("setEditor.aiDraftMissing")} />
      </div>
    );

  const organizeHref = `/sets/new/organize?folderId=${encodeURIComponent(draft.folderId)}`;

  const save = async (rows: AssistedWordRow[]) => {
    const saved = await saveSet({
      folderId: draft.folderId,
      setName: draft.name,
      words: rows.map((row) => ({
        examples: row.examples.map((value) => value.trim()).filter(Boolean),
        meaningZh: row.meaningZh,
        pos: row.pos,
        supplementary: row.supplementary,
        word: row.word,
      })),
    });
    clearAiSetDraft();
    router.push(`/sets/${saved.id}`);
  };

  return (
    <StepFrame
      {...(phase === "review"
        ? { onBack: () => setPhase("run") }
        : { back: <BackControl href={organizeHref} /> })}
      current={phase === "review" ? 4 : 3}
      title={t(
        phase === "review" ? "setEditor.aiReviewTitle" : "setEditor.aiGenerateTitle",
      )}
      total={4}
      width="wide"
    >
      <WordAssistant
        onApply={save}
        onPhase={setPhase}
        phase={phase}
        sources={draft.sources}
      />
    </StepFrame>
  );
}

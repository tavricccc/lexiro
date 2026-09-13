"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  WordAssistant,
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

  const save = async (rows: AssistedWordRow[]) => {
    const saved = await saveSet({
      setName: draft.name,
      words: rows.map((row) => ({
        examples: row.examples.map((value) => value.trim()).filter(Boolean),
        meaningZh: row.meaningZh,
        pos: row.pos,
        word: row.word,
      })),
    });
    clearAiSetDraft();
    router.push(`/sets/${saved.id}`);
  };

  return (
    <StepFrame
      back={<BackControl href="/sets/new/organize" />}
      current={2}
      title={t("setEditor.aiGenerateTitle")}
      total={2}
      width="wide"
    >
      <WordAssistant onApply={save} sources={draft.sources} />
    </StepFrame>
  );
}

"use client";

import { useRouter } from "next/navigation";

import { WordEditor } from "@/components/library/word-editor";
import { EmptyState } from "@/components/ui/page-state";
import { t } from "@/lib/i18n";
import { prepareWordEdit } from "@/src/lib/word-edit";
import type { WordKey } from "@/types";
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

  return (
    <WordEditor
      onCancel={() => router.push(`/sets/${setId}`)}
      onSave={async (draft) => {
        const store = useLibraryStore.getState();
        const input = prepareWordEdit(store.state, setId, key, draft);
        await store.saveSet(input);
        if (input.remaps.length)
          await useLearningStore.getState().remapSenses(input.remaps);
        router.push(`/sets/${setId}`);
      }}
      value={{
        word: word.word,
        senses: senses.map((sense) => ({
          id: sense.id,
          pos: sense.pos,
          meaning: sense.meaningZh,
          examples: sense.examples,
        })),
      }}
    />
  );
}

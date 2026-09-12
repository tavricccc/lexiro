"use client";
import { useState } from "react";
import type { CardProgress, SenseId, WordKey, WordSense } from "@/types";
import { WordEditor } from "@/components/library/word-editor";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { t } from "@/lib/i18n";
import { isDue, isLeech } from "@/src/lib/fsrs";
import { prepareWordEdit } from "@/src/lib/word-edit";
import { useLibraryStore } from "@/stores/library-store";
import { useLearningStore } from "@/stores/learning-store";

export interface ViewWord { wordKey: WordKey; word: string; senses: WordSense[] }

export function SetWordRow({ entry, setId, cards }: { entry: ViewWord; setId: string; cards: Record<SenseId, CardProgress> }) {
  const [editing, setEditing] = useState(false);
  if (editing) return <WordEditor value={{ word: entry.word, senses: entry.senses.map((sense) => ({ id: sense.id, pos: sense.pos, meaning: sense.meaningZh, examples: sense.examples })) }} onCancel={() => setEditing(false)} onSave={async (draft) => {
    const store = useLibraryStore.getState();
    const input = prepareWordEdit(store.state, setId, entry.wordKey, draft);
    await store.saveSet(input);
    if (input.remaps.length) await useLearningStore.getState().remapSenses(input.remaps);
    setEditing(false);
  }} />;
  return <div>
    <div className="flex items-center justify-between gap-3"><button type="button" className="text-left text-base font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40" onClick={() => setEditing(true)}>{entry.word}</button><Button variant="ghost" size="icon" aria-label={t("setDetail.edit")} onClick={() => setEditing(true)}><Icons.edit /></Button></div>
    <dl className="mt-2 grid gap-3">{entry.senses.map((sense) => {
      const card = cards[sense.id] ?? null;
      return <div key={sense.id}><dt className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-sm"><span className="text-muted-foreground">{sense.pos}</span><span className="font-medium">{sense.meaningZh}</span>{card && isDue(card) && <span className="text-xs text-brand-600">{t("setDetail.dueBadge")}</span>}{isLeech(card) && <span className="text-xs text-destructive">{t("setDetail.leechBadge")}</span>}</dt><dd className="mt-1.5 grid gap-1">{sense.examples.map((example, index) => <p className="type-lead" key={index}>{example}</p>)}</dd></div>;
    })}</dl>
  </div>;
}

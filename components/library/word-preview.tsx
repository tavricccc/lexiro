"use client";
import { useState } from "react";
import type { WordDraft } from "@/types";
import { WordEditor } from "@/components/library/word-editor";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { t } from "@/lib/i18n";

export function WordPreview({ word, disabled, onSave }: { word: WordDraft; disabled: boolean; onSave: (draft: WordDraft) => void }) {
  const [editing, setEditing] = useState(false);
  if (editing) return <WordEditor value={word} onCancel={() => setEditing(false)} onSave={(draft) => { onSave(draft); setEditing(false); }} />;
  return <div><div className="flex items-center justify-between"><p className="font-semibold">{word.word}</p><Button type="button" variant="ghost" size="icon" disabled={disabled} aria-label={t("setDetail.edit")} onClick={() => setEditing(true)}><Icons.edit /></Button></div>{word.senses.map((sense) => <div key={sense.id} className="mt-1.5"><p className="text-sm"><span className="mr-2 text-xs text-muted-foreground">{sense.pos}</span>{sense.meaning}</p>{sense.examples.map((example, index) => <p key={index} className="mt-1 text-xs leading-5 text-muted-foreground">{example}</p>)}</div>)}</div>;
}

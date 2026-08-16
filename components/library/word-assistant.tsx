"use client";

import { Check, X } from "lucide-react";
import { useMemo, useState } from "react";

import { AiActions } from "@/components/ai/ai-actions";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { buildImportPrompt } from "@/src/lib/importPrompt";
import { buildWordGenerationSources, parseWordGenerationJson } from "@/src/lib/word-generation";

export interface AssistedWordRow { word: string; pos: string; meaningZh: string; example: string }

export function WordAssistant({ onApply, onClose }: { onApply: (rows: AssistedWordRow[]) => void; onClose: () => void }) {
  const [raw, setRaw] = useState("");
  const [examples, setExamples] = useState(false);
  const [response, setResponse] = useState("");
  const [preview, setPreview] = useState<AssistedWordRow[]>([]);
  const [error, setError] = useState("");
  const sources = useMemo(() => buildWordGenerationSources(raw), [raw]);
  const prompt = useMemo(() => buildImportPrompt(raw, sources, examples), [examples, raw, sources]);

  const validate = (value = response) => {
    setError("");
    try {
      const rows = parseWordGenerationJson(value, sources, examples).flatMap((word) => word.senses.map((sense) => ({ word: word.word, pos: sense.pos, meaningZh: sense.meaning, example: sense.examples.join("\n") })));
      setPreview(rows);
    } catch (reason) {
      setPreview([]);
      setError(t("setEditor.invalidAiResponse", { message: reason instanceof Error ? reason.message : String(reason) }));
    }
  };

  return <section className="mt-6 rounded-2xl bg-muted p-5 sm:p-6"><div className="flex items-start gap-4"><div className="min-w-0 flex-1"><h2 className="font-semibold">{t("setEditor.aiAssist")}</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">{t("setEditor.aiAssistDescription")}</p></div><Button type="button" variant="ghost" size="icon" className="size-9 min-h-9" onClick={onClose}><X className="size-4" /><span className="sr-only">{t("common.cancel")}</span></Button></div><label className="mt-5 block"><span className="mb-2 block text-xs font-semibold text-muted-foreground">{t("setEditor.rawWords")}</span><textarea value={raw} onChange={(event) => { setRaw(event.target.value); setPreview([]); }} placeholder={t("setEditor.rawWordsPlaceholder")} className="min-h-32 w-full rounded-xl border bg-card px-3.5 py-3 text-sm leading-6 outline-none focus:border-primary" /></label><label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={examples} onChange={(event) => { setExamples(event.target.checked); setPreview([]); }} className="accent-primary" />{t("setEditor.generateExamples")}</label><div className="mt-4"><AiActions prompt={prompt} disabled={!sources.length} onError={setError} onResponse={(value) => { setResponse(value); validate(value); }} /></div>{sources.length > 0 && <details className="mt-4"><summary className="cursor-pointer text-xs font-semibold text-muted-foreground">{t("ai.viewPrompt")}</summary><textarea readOnly value={prompt} className="mt-2 h-36 w-full resize-y rounded-xl border bg-card p-3 text-xs leading-5" /></details>}<label className="mt-4 block"><span className="mb-2 block text-xs font-semibold text-muted-foreground">{t("ai.manualResponse")}</span><textarea value={response} onChange={(event) => { setResponse(event.target.value); setPreview([]); }} className="h-36 w-full resize-y rounded-xl border bg-card p-3 text-xs leading-5 outline-none focus:border-primary" /></label><Button type="button" className="mt-3" variant="secondary" disabled={!response.trim()} onClick={() => validate()}>{t("ai.validate")}</Button>{error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}{preview.length > 0 && <div className="mt-5 border-y py-4"><p className="flex items-center gap-2 text-sm font-semibold text-foreground"><Check className="size-4" />{t("ai.readyCount", { count: preview.length })}</p><div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">{preview.slice(0, 8).map((row, index) => <span key={`${row.word}-${row.pos}-${index}`}>{row.word} · {row.meaningZh}</span>)}</div><Button type="button" className="mt-4" onClick={() => { onApply(preview); onClose(); }}>{t("setEditor.applyPreview", { count: preview.length })}</Button></div>}</section>;
}

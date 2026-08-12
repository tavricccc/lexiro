"use client";

import { Clipboard, Sparkles, X } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { generateWithAi } from "@/src/lib/ai-provider";
import { copyToClipboard } from "@/src/lib/clipboard";
import { buildImportPrompt } from "@/src/lib/importPrompt";
import { buildWordGenerationSources, parseWordGenerationJson } from "@/src/lib/word-generation";

export interface AssistedWordRow { word: string; pos: string; meaningZh: string; example: string }

export function WordAssistant({ onApply, onClose }: { onApply: (rows: AssistedWordRow[]) => void; onClose: () => void }) {
  const [raw, setRaw] = useState("");
  const [examples, setExamples] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const sources = useMemo(() => buildWordGenerationSources(raw), [raw]);
  const createPrompt = () => { setPrompt(buildImportPrompt(raw, sources, examples)); setError(""); };
  const callAi = async () => {
    const value = prompt || buildImportPrompt(raw, sources, examples); setPrompt(value); setBusy(true); setError("");
    try {
      const saved = JSON.parse(localStorage.getItem("lexiro-next-ai-settings") ?? "{}") as { provider?: string; model?: string; endpoint?: string; batchSize?: number };
      const provider = (["openai", "anthropic", "google", "custom"].includes(saved.provider ?? "") ? saved.provider : "openai") as "openai" | "anthropic" | "google" | "custom";
      setResponse(await generateWithAi({ enabled: true, provider, apiKey: localStorage.getItem("lexiro-next-ai-api-key") ?? "", baseUrl: saved.endpoint ?? "", model: saved.model ?? "gpt-5-mini", batchSize: saved.batchSize ?? 10 }, value, { responseFormat: "json" }));
    } catch (reason) { setError(t("setEditor.invalidAiResponse", { message: reason instanceof Error ? reason.message : String(reason) })); }
    finally { setBusy(false); }
  };
  const apply = () => {
    try {
      const drafts = parseWordGenerationJson(response, sources, examples);
      onApply(drafts.flatMap((word) => word.senses.map((sense) => ({ word: word.word, pos: sense.pos, meaningZh: sense.meaning, example: sense.examples.join("\n") })))); onClose();
    } catch (reason) { setError(t("setEditor.invalidAiResponse", { message: reason instanceof Error ? reason.message : String(reason) })); }
  };
  return <section className="mt-6 rounded-2xl bg-brand-soft p-5 sm:p-6"><div className="flex items-start gap-4"><div className="min-w-0 flex-1"><h2 className="font-semibold">{t("setEditor.aiAssist")}</h2><p className="mt-1 text-sm leading-6 text-ink-muted">{t("setEditor.aiAssistDescription")}</p></div><Button type="button" variant="ghost" size="icon" className="size-9 min-h-9" onClick={onClose}><X className="size-4" /><span className="sr-only">{t("common.cancel")}</span></Button></div><label className="mt-5 block"><span className="mb-2 block text-xs font-semibold text-ink-muted">{t("setEditor.rawWords")}</span><textarea value={raw} onChange={(event) => setRaw(event.target.value)} placeholder={t("setEditor.rawWordsPlaceholder")} className="min-h-32 w-full rounded-xl border bg-surface px-3.5 py-3 text-sm leading-6 outline-none focus:border-brand" /></label><label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={examples} onChange={(event) => setExamples(event.target.checked)} className="accent-[var(--brand)]" />{t("setEditor.generateExamples")}</label><div className="mt-4 flex flex-wrap gap-2"><Button type="button" disabled={!sources.length} onClick={createPrompt}>{t("setEditor.buildPrompt")}</Button><Button type="button" variant="secondary" disabled={!sources.length || busy} onClick={() => void callAi()}><Sparkles className="size-4" />{busy ? t("questions.generating") : t("setEditor.callAi")}</Button>{prompt && <Button type="button" variant="ghost" onClick={() => void copyToClipboard(prompt)}><Clipboard className="size-4" />{t("questions.copyPrompt")}</Button>}</div>{prompt && <textarea readOnly value={prompt} className="mt-4 h-36 w-full resize-y rounded-xl border bg-surface p-3 text-xs leading-5" />}<label className="mt-4 block"><span className="mb-2 block text-xs font-semibold text-ink-muted">{t("setEditor.aiResponse")}</span><textarea value={response} onChange={(event) => setResponse(event.target.value)} className="h-36 w-full resize-y rounded-xl border bg-surface p-3 text-xs leading-5 outline-none focus:border-brand" /></label>{error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}<Button type="button" className="mt-4" disabled={!response.trim()} onClick={apply}>{t("setEditor.applyPreview", { count: sources.length })}</Button></section>;
}

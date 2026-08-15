"use client";

import type { LibraryQuestion } from "@/types";
import { ArrowLeft, Check, Clipboard } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { useLibraryStore } from "@/stores/library-store";
import { generateWithAi } from "@/src/lib/ai-provider";
import { copyToClipboard } from "@/src/lib/clipboard";
import { parseLibraryImport } from "@/src/lib/library-import";
import { buildQuestionGenerationPrompt, generationSenseKey, getQuestionSourceRefs, getSelectedGenerationWords, normalizeQuestionGenerationJson, type GeneratedQuestionKind } from "@/src/lib/question-generation";

export function QuestionGenerator({ setId }: { setId?: string }) {
  const { state, saveQuestion } = useLibraryStore();
  const allowedSenseIds = useMemo(() => setId ? new Set((state.memberships[setId] ?? []).flatMap((entry) => entry.senseIds)) : null, [setId, state.memberships]);
  const senses = useMemo(() => Object.values(state.words).flatMap((word) => word.senses.filter((sense) => !allowedSenseIds || allowedSenseIds.has(sense.id)).map((sense) => ({ key: generationSenseKey(word.wordKey, sense.id), word: word.word, pos: sense.pos, meaning: sense.meaningZh }))), [allowedSenseIds, state.words]);
  const [selected, setSelected] = useState<string[]>([]);
  const [kind, setKind] = useState<GeneratedQuestionKind>("multipleChoice");
  const [difficulty, setDifficulty] = useState<1 | 2 | 3>(2);
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [preview, setPreview] = useState<LibraryQuestion[]>([]);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  const words = getSelectedGenerationWords(Object.values(state.words), selected);

  const makePrompt = () => setPrompt(buildQuestionGenerationPrompt(words, kind, difficulty));
  const callAi = async () => {
    const nextPrompt = prompt || buildQuestionGenerationPrompt(words, kind, difficulty); setPrompt(nextPrompt); setGenerating(true); setError("");
    try {
      const saved = JSON.parse(localStorage.getItem("lexiro-next-ai-settings") ?? "{}") as { provider?: string; model?: string; endpoint?: string; batchSize?: number };
      const provider = (["openai", "anthropic", "google", "custom"].includes(saved.provider ?? "") ? saved.provider : "openai") as "openai" | "anthropic" | "google" | "custom";
      const text = await generateWithAi({ enabled: true, provider, apiKey: localStorage.getItem("lexiro-next-ai-api-key") ?? "", baseUrl: saved.endpoint ?? "", model: saved.model ?? "gpt-5-mini", batchSize: saved.batchSize ?? 10 }, nextPrompt, { responseFormat: "json" });
      setResponse(text);
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setGenerating(false); }
  };
  const validate = () => {
    setError("");
    try {
      const normalized = normalizeQuestionGenerationJson(response, kind, difficulty, words);
      const parsed = parseLibraryImport(normalized, { questionSources: getQuestionSourceRefs(words), allowedDifficulty: difficulty, expectedQuestionKind: kind === "reading" ? "reading" : "multipleChoice", expectedQuestionStyle: kind === "fillBlank" ? "fillBlank" : kind === "multipleChoice" ? "standard" : undefined, requireEnglish: true });
      if (!parsed.valid) throw new Error(parsed.error);
      if (parsed.data.kind !== "questions") throw new Error("questions expected");
      setPreview(parsed.data.questions);
    } catch (reason) { setPreview([]); setError(t("questions.invalidResponse", { message: reason instanceof Error ? reason.message : String(reason) })); }
  };
  const addAll = async () => { for (const question of preview) await saveQuestion(question); };

  return <div><PageHeader title={t("questions.generateTitle")} description={t("questions.generateDescription")} actions={<Button asChild variant="ghost"><Link href="/questions"><ArrowLeft className="size-4" />{t("common.back")}</Link></Button>} /><div className="grid gap-8 lg:grid-cols-[320px_minmax(0,1fr)]"><aside><div className="flex gap-2"><select value={kind} onChange={(event) => setKind(event.target.value as GeneratedQuestionKind)} className="h-11 flex-1 rounded-xl border bg-card px-3 text-sm"><option value="multipleChoice">{t("questions.standard")}</option><option value="fillBlank">{t("questions.fillBlank")}</option><option value="reading">{t("questions.reading")}</option></select><select value={difficulty} onChange={(event) => setDifficulty(Number(event.target.value) as 1 | 2 | 3)} className="h-11 rounded-xl border bg-card px-3">{[1,2,3].map((value) => <option key={value}>{value}</option>)}</select></div><div className="mt-5 flex items-center justify-between"><span className="text-xs font-semibold text-muted-foreground">{t("questions.selectedCount", { count: selected.length })}</span><div className="flex gap-2"><button onClick={() => setSelected(senses.map((sense) => sense.key))} className="text-xs text-brand">{t("questions.selectAll")}</button><button onClick={() => setSelected([])} className="text-xs text-muted-foreground">{t("questions.clear")}</button></div></div><div className="mt-3 max-h-[460px] overflow-y-auto border-y">{senses.map((sense) => <label key={sense.key} className="flex cursor-pointer gap-3 border-b py-3 last:border-0"><input type="checkbox" checked={selected.includes(sense.key)} onChange={(event) => setSelected(event.target.checked ? [...selected, sense.key] : selected.filter((key) => key !== sense.key))} className="mt-1 accent-primary" /><span><b className="text-sm">{sense.word}</b><span className="ml-2 text-xs text-foreground">{sense.pos}</span><span className="mt-1 block text-xs text-muted-foreground">{sense.meaning}</span></span></label>)}</div></aside><section><div className="flex flex-wrap gap-2"><Button disabled={!selected.length} onClick={makePrompt}>{t("questions.createPrompt")}</Button><Button variant="secondary" disabled={!selected.length || generating} onClick={() => void callAi()}>{generating ? t("questions.generating") : t("questions.callAi")}</Button></div>{prompt && <><div className="mt-5 flex justify-end"><Button variant="ghost" size="sm" onClick={() => void copyToClipboard(prompt)}><Clipboard className="size-4" />{t("questions.copyPrompt")}</Button></div><textarea readOnly value={prompt} className="h-52 w-full resize-y rounded-2xl border bg-card p-4 text-xs leading-5 outline-none" /><label className="mt-6 block text-xs font-semibold text-muted-foreground">{t("questions.response")}</label><textarea value={response} onChange={(event) => setResponse(event.target.value)} className="mt-2 h-52 w-full resize-y rounded-2xl border bg-card p-4 text-xs leading-5 outline-none focus-visible:border-ring" /><Button className="mt-4" onClick={validate}>{t("questions.validate")}</Button></>}{error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}{preview.length > 0 && <div className="mt-8"><div className="flex items-center justify-between"><h2 className="text-xl font-semibold">{t("questions.generatedCount", { count: preview.length })}</h2><Button onClick={() => void addAll()}><Check className="size-4" />{t("questions.addAll")}</Button></div><div className="mt-4 divide-y border-y">{preview.map((question) => <div key={question.id} className="py-4 text-sm font-medium">{question.kind === "reading" ? question.title : question.prompt}</div>)}</div></div>}</section></div></div>;
}

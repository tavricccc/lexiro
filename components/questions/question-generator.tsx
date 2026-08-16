"use client";

import type { LibraryQuestion } from "@/types";
import { ArrowLeft, Check } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AiActions } from "@/components/ai/ai-actions";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { useLibraryStore } from "@/stores/library-store";
import { parseLibraryImport } from "@/src/lib/library-import";
import { buildQuestionGenerationPrompt, generationSenseKey, getQuestionSourceRefs, getSelectedGenerationWords, normalizeQuestionGenerationJson, QUESTION_BATCH_SIZE, type GeneratedQuestionKind } from "@/src/lib/question-generation";

export function QuestionGenerator({ setId }: { setId?: string }) {
  const { state, saveQuestion } = useLibraryStore();
  const allowedSenseIds = useMemo(() => setId ? new Set((state.memberships[setId] ?? []).flatMap((entry) => entry.senseIds)) : null, [setId, state.memberships]);
  const senses = useMemo(() => Object.values(state.words).flatMap((word) => word.senses.filter((sense) => !allowedSenseIds || allowedSenseIds.has(sense.id)).map((sense) => ({ key: generationSenseKey(word.wordKey, sense.id), word: word.word, pos: sense.pos, meaning: sense.meaningZh }))), [allowedSenseIds, state.words]);
  const [selected, setSelected] = useState<string[]>([]);
  const [selectionReady, setSelectionReady] = useState(false);
  const [kind, setKind] = useState<GeneratedQuestionKind>("multipleChoice");
  const [difficulty, setDifficulty] = useState<1 | 2 | 3>(2);
  const [response, setResponse] = useState("");
  const [preview, setPreview] = useState<LibraryQuestion[]>([]);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const words = useMemo(() => getSelectedGenerationWords(Object.values(state.words), selected), [selected, state.words]);
  const prompt = useMemo(() => buildQuestionGenerationPrompt(words, kind, difficulty), [difficulty, kind, words]);

  useEffect(() => {
    if (selectionReady || !senses.length) return;
    setSelected(senses.slice(0, QUESTION_BATCH_SIZE).map((sense) => sense.key));
    setSelectionReady(true);
  }, [selectionReady, senses]);

  const validate = (value = response) => {
    setError("");
    setSaved(false);
    try {
      const normalized = normalizeQuestionGenerationJson(value, kind, difficulty, words);
      const parsed = parseLibraryImport(normalized, { questionSources: getQuestionSourceRefs(words), allowedDifficulty: difficulty, expectedQuestionKind: kind === "reading" ? "reading" : "multipleChoice", expectedQuestionStyle: kind === "fillBlank" ? "fillBlank" : kind === "multipleChoice" ? "standard" : undefined, requireEnglish: true });
      if (!parsed.valid) throw new Error(parsed.error);
      if (parsed.data.kind !== "questions") throw new Error("questions expected");
      setPreview(parsed.data.questions);
    } catch (reason) {
      setPreview([]);
      setError(t("questions.invalidResponse", { message: reason instanceof Error ? reason.message : String(reason) }));
    }
  };

  const addAll = async () => {
    for (const question of preview) await saveQuestion(question);
    setSaved(true);
  };

  const toggleSense = (key: string, checked: boolean) => {
    setPreview([]);
    setSaved(false);
    if (checked) {
      if (selected.length >= QUESTION_BATCH_SIZE) return;
      setSelected([...selected, key]);
    } else setSelected(selected.filter((value) => value !== key));
  };

  return <div><PageHeader title={t("questions.generateTitle")} description={t("questions.generateDescription")} actions={<Button asChild variant="ghost"><Link href="/questions"><ArrowLeft className="size-4" />{t("common.back")}</Link></Button>} /><div className="grid gap-8 lg:grid-cols-[320px_minmax(0,1fr)]"><aside><div className="flex gap-2"><select value={kind} onChange={(event) => { setKind(event.target.value as GeneratedQuestionKind); setPreview([]); }} className="h-11 flex-1 rounded-xl border bg-card px-3 text-sm"><option value="multipleChoice">{t("questions.standard")}</option><option value="fillBlank">{t("questions.fillBlank")}</option><option value="reading">{t("questions.reading")}</option></select><select aria-label={t("practice.difficulty")} value={difficulty} onChange={(event) => { setDifficulty(Number(event.target.value) as 1 | 2 | 3); setPreview([]); }} className="h-11 rounded-xl border bg-card px-3">{[1,2,3].map((value) => <option key={value}>{value}</option>)}</select></div><div className="mt-5 flex items-center justify-between"><span className="text-xs font-semibold text-muted-foreground">{t("questions.selectedCount", { count: selected.length })}</span><div className="flex gap-2"><button type="button" onClick={() => { setSelected(senses.slice(0, QUESTION_BATCH_SIZE).map((sense) => sense.key)); setPreview([]); }} className="text-xs text-primary">{t("questions.selectAll")}</button><button type="button" onClick={() => { setSelected([]); setPreview([]); }} className="text-xs text-muted-foreground">{t("questions.clear")}</button></div></div><p className="mt-2 text-xs leading-5 text-muted-foreground">{t("questions.batchLimit", { count: QUESTION_BATCH_SIZE })}</p><div className="mt-3 max-h-[460px] overflow-y-auto border-y">{senses.map((sense) => <label key={sense.key} className="flex cursor-pointer gap-3 border-b py-3 last:border-0"><input type="checkbox" checked={selected.includes(sense.key)} disabled={!selected.includes(sense.key) && selected.length >= QUESTION_BATCH_SIZE} onChange={(event) => toggleSense(sense.key, event.target.checked)} className="mt-1 accent-primary" /><span><b className="text-sm">{sense.word}</b><span className="ml-2 text-xs text-foreground">{sense.pos}</span><span className="mt-1 block text-xs text-muted-foreground">{sense.meaning}</span></span></label>)}</div></aside><section><AiActions prompt={prompt} disabled={!selected.length} onError={setError} onResponse={(value) => { setResponse(value); validate(value); }} /><details className="mt-5"><summary className="cursor-pointer text-xs font-semibold text-muted-foreground">{t("ai.viewPrompt")}</summary><textarea readOnly value={prompt} className="mt-2 h-52 w-full resize-y rounded-2xl border bg-card p-4 text-xs leading-5 outline-none" /></details><label className="mt-6 block text-xs font-semibold text-muted-foreground">{t("ai.manualResponse")}</label><textarea value={response} onChange={(event) => { setResponse(event.target.value); setPreview([]); setSaved(false); }} className="mt-2 h-52 w-full resize-y rounded-2xl border bg-card p-4 text-xs leading-5 outline-none focus:border-primary" /><Button className="mt-4" variant="secondary" disabled={!response.trim()} onClick={() => validate()}>{t("ai.validate")}</Button>{error && <p role="alert" className="mt-4 rounded-xl bg-destructive/10 p-3 text-sm text-destructive dark:bg-red-950/35 dark:text-red-200">{error}</p>}{preview.length > 0 && <div className="mt-8"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">{t("questions.generatedCount", { count: preview.length })}</h2>{saved ? <Button asChild><Link href="/practice?mode=questions"><Check className="size-4" />{t("questions.startGenerated")}</Link></Button> : <Button onClick={() => void addAll()}><Check className="size-4" />{t("questions.addAll")}</Button>}</div>{saved && <p role="status" className="mt-3 text-sm text-foreground">{t("questions.saved")}</p>}<div className="mt-4 divide-y border-y">{preview.map((question) => <div key={question.id} className="py-4 text-sm font-medium">{question.kind === "reading" ? question.title : question.prompt}</div>)}</div></div>}</section></div></div>;
}

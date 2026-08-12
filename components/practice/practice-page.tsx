"use client";

import type { LibraryQuestion, ReviewRating, StudyWord, WordEntry } from "@/types";
import { ArrowLeft, Bookmark, SkipForward, Volume2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { ResultPanel } from "@/components/practice/result-panel";
import { t } from "@/lib/i18n";
import { useLearningStore } from "@/stores/learning-store";
import { useLibraryStore } from "@/stores/library-store";
import { isDue } from "@/src/lib/fsrs";
import { senseToStudyWord } from "@/src/lib/library";
import { allocateDailyQuestionQuotas } from "@/src/lib/question-distribution";

type Mode = "review" | "questions";
type QuestionType = "all" | "standard" | "fillBlank" | "reading";
interface QuestionItem { question: LibraryQuestion; prompt: string; options: string[]; answerIndex: number; senseId: string; type: "standard" | "fillBlank" | "reading"; difficulty: 1 | 2 | 3; meaning: string }

export function PracticePage({ initialMode = "review", initialSet = "" }: { initialMode?: Mode; initialSet?: string }) {
  const { state, status } = useLibraryStore();
  const learning = useLearningStore();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [setId, setSetId] = useState(initialSet);
  const [amount, setAmount] = useState(10);
  const [questionType, setQuestionType] = useState<QuestionType>("all");
  const [difficulty, setDifficulty] = useState<"all" | "1" | "2" | "3">("all");
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState<number[]>([]);
  const [skipped, setSkipped] = useState<number[]>([]);
  const [marked, setMarked] = useState<number[]>([]);
  const [retryQuestions, setRetryQuestions] = useState<QuestionItem[] | null>(null);
  const [retryReviews, setRetryReviews] = useState<StudyWord[] | null>(null);
  const [questionFailedSenses, setQuestionFailedSenses] = useState<string[]>([]);

  const allowedSenseIds = useMemo(() => new Set((setId ? state.memberships[setId] ?? [] : Object.values(state.memberships).flat()).flatMap((entry) => entry.senseIds)), [setId, state.memberships]);
  const reviewItems = useMemo(() => {
    const items = Object.values(state.words).flatMap((word) => word.senses.filter((sense) => allowedSenseIds.has(sense.id)).map((sense) => senseToStudyWord(word, sense)));
    const due = items.filter((item) => learning.progress.cards[item.id] && isDue(learning.progress.cards[item.id])).sort((a, b) => new Date(learning.progress.cards[a.id].due).getTime() - new Date(learning.progress.cards[b.id].due).getTime());
    const fresh = items.filter((item) => !learning.progress.cards[item.id]);
    const freshLimit = due.length ? Math.ceil(amount / 3) : amount;
    return [...due.slice(0, amount - Math.min(freshLimit, fresh.length)), ...fresh.slice(0, freshLimit)].slice(0, amount);
  }, [allowedSenseIds, amount, learning.progress.cards, state.words]);
  const questionItems = useMemo(() => {
    const groups = state.questions.map((question): QuestionItem[] => {
      if (question.kind === "reading") return question.questions.filter((child) => allowedSenseIds.has(child.senseId)).map((child) => ({ question, prompt: child.prompt, options: child.options, answerIndex: child.answerIndex, senseId: child.senseId, type: "reading", difficulty: question.difficulty, meaning: findMeaning(state.words, child.senseId) }));
      if (!allowedSenseIds.has(question.senseId)) return [];
      return [{ question, prompt: question.prompt, options: question.options, answerIndex: question.answerIndex, senseId: question.senseId, type: question.questionStyle, difficulty: question.difficulty, meaning: findMeaning(state.words, question.senseId) }];
    }).filter((group) => group.length > 0 && (questionType === "all" || group[0]?.type === questionType) && (difficulty === "all" || group[0]?.difficulty === Number(difficulty)));
    const buckets = [1, 2, 3].map((difficulty) => groups.filter((group) => group[0]?.difficulty === difficulty));
    const orderedGroups: QuestionItem[][] = [];
    while (buckets.some((bucket) => bucket.length)) for (const bucket of buckets) { const group = bucket.shift(); if (group) orderedGroups.push(group); }
    const result: QuestionItem[] = [];
    const usedSenses = new Set<string>();
    const usedGroups = new Set<QuestionItem[]>();
    const take = (group: QuestionItem[], target = amount) => {
      if (usedGroups.has(group) || result.length >= target) return false;
      if (group[0]?.type === "reading" && result.length > 0 && result.length >= target) return false;
      usedGroups.add(group);
      result.push(...group); group.forEach((item) => usedSenses.add(item.senseId)); return true;
    };
    const takeGroups = (candidates: QuestionItem[][], target: number) => {
      const end = result.length + target;
      for (const group of candidates) { if (!group.some((item) => usedSenses.has(item.senseId))) take(group, end); if (result.length >= end) break; }
      for (const group of candidates) { if (result.length >= end) break; take(group, end); }
    };
    if (questionType === "all") {
      const [standard, fillBlank, reading] = allocateDailyQuestionQuotas(amount);
      takeGroups(orderedGroups.filter((group) => group[0]?.type === "standard"), standard);
      takeGroups(orderedGroups.filter((group) => group[0]?.type === "fillBlank"), fillBlank);
      takeGroups(orderedGroups.filter((group) => group[0]?.type === "reading"), reading);
      if (result.length < amount) takeGroups(orderedGroups, amount - result.length);
    } else takeGroups(orderedGroups, amount);
    return result;
  }, [allowedSenseIds, amount, difficulty, questionType, state.questions, state.words]);
  const activeReviews = retryReviews ?? reviewItems;
  const activeQuestions = retryQuestions ?? questionItems;
  const total = mode === "review" ? activeReviews.length : activeQuestions.length;
  const complete = started && index >= total;
  const wrongContent = wrong.map((value) => mode === "review" ? `${activeReviews[value]?.word}: ${activeReviews[value]?.meaning}` : `${activeQuestions[value]?.prompt}\n${t("practice.answer", { answer: activeQuestions[value]?.options[activeQuestions[value]?.answerIndex] ?? "" })}`).join("\n\n");

  useEffect(() => {
    try {
      const raw = localStorage.getItem("lexiro-practice-session-v2");
      if (!raw || initialSet || initialMode !== "review") return;
      const saved = JSON.parse(raw) as { mode: Mode; setId: string; amount: number; index: number; correct: number; wrong: number[]; skipped?: number[]; marked?: number[]; questionType?: QuestionType; difficulty?: "all" | "1" | "2" | "3" };
      setMode(saved.mode); setSetId(saved.setId); setAmount(saved.amount); setIndex(saved.index); setCorrect(saved.correct); setWrong(saved.wrong); setSkipped(saved.skipped ?? []); setMarked(saved.marked ?? []); setQuestionType(saved.questionType ?? "all"); setDifficulty(saved.difficulty ?? "all"); setStarted(true);
    } catch { /* ignore invalid session */ }
  }, [initialMode, initialSet]);
  useEffect(() => {
    if (!learning.loaded || started) return;
    try {
      const saved = JSON.parse(localStorage.getItem("lexiro-practice-preferences-v2") ?? "{}") as { setId?: string; amount?: number; questionType?: QuestionType; difficulty?: "all" | "1" | "2" | "3" };
      if (!initialSet && saved.setId) setSetId(saved.setId);
      if (saved.amount) setAmount(saved.amount);
      if (saved.questionType) setQuestionType(saved.questionType);
      if (saved.difficulty) setDifficulty(saved.difficulty);
    } catch { /* use defaults */ }
  }, [initialSet, learning.loaded, started]);
  useEffect(() => {
    if (started) return;
    localStorage.setItem("lexiro-practice-preferences-v2", JSON.stringify({ setId, amount, questionType, difficulty }));
  }, [amount, difficulty, questionType, setId, started]);
  useEffect(() => {
    if (!started) return;
    if (complete) { localStorage.removeItem("lexiro-practice-session-v2"); return; }
    localStorage.setItem("lexiro-practice-session-v2", JSON.stringify({ mode, setId, amount, index, correct, wrong, skipped, marked, questionType, difficulty }));
  }, [amount, complete, correct, difficulty, index, marked, mode, questionType, setId, skipped, started, wrong]);

  const next = () => { setIndex((value) => value + 1); setRevealed(false); setSelected(null); };
  const rate = async (rating: ReviewRating) => { const item = activeReviews[index]; if (!item) return; await learning.rateSense(item.id, rating); if (rating === "good") setCorrect((value) => value + 1); else setWrong((value) => [...value, index]); next(); };
  const answer = async (choice: number) => { if (selected !== null) return; const item = activeQuestions[index]; if (!item) return; const isCorrect = choice === item.answerIndex; setSelected(choice); setRevealed(true); if (isCorrect) setCorrect((value) => value + 1); else setWrong((value) => [...value, index]); const card = learning.progress.cards[item.senseId]; const reviewedToday = card?.lastReview ? new Date(card.lastReview).toLocaleDateString("en-CA") === new Date().toLocaleDateString("en-CA") : false; if (!isCorrect && !questionFailedSenses.includes(item.senseId)) { setQuestionFailedSenses((values) => [...values, item.senseId]); await learning.scheduleSenseFromQuestion(item.senseId, "again"); } else if (isCorrect && !reviewedToday) await learning.scheduleSenseFromQuestion(item.senseId, "good"); await learning.recordQuestion(item.senseId, item.type, item.difficulty, isCorrect, Boolean(retryQuestions)); };
  const skip = async () => { const item = activeQuestions[index]; if (!item || selected !== null) return; setSkipped((values) => [...values, index]); setWrong((values) => [...values, index]); await learning.recordQuestion(item.senseId, item.type, item.difficulty, false, Boolean(retryQuestions)); next(); };
  const toggleMark = () => setMarked((values) => values.includes(index) ? values.filter((value) => value !== index) : [...values, index]);

  useEffect(() => {
    if (!started || complete) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (mode === "review") {
        if (!revealed && event.key === "Enter") setRevealed(true);
        else if (revealed && event.key.toLocaleLowerCase() === "a") void rate("again");
        else if (revealed && event.key.toLocaleLowerCase() === "g") void rate("good");
        return;
      }
      const choices = ["1", "2", "3", "4", "a", "b", "c", "d"];
      const choice = choices.indexOf(event.key.toLocaleLowerCase());
      if (selected === null && choice >= 0) void answer(choice % 4);
      else if (selected !== null && event.key === "Enter") next();
    };
    window.addEventListener("keydown", onKeyDown); return () => window.removeEventListener("keydown", onKeyDown);
  }, [complete, mode, revealed, selected, started, index]);

  if (status !== "ready" || !learning.loaded) return <div className="py-20 text-center text-sm text-ink-muted">{t("library.loading")}</div>;
  if (!started) return <div className="mx-auto max-w-xl"><Link href="/" className="mb-7 inline-flex items-center gap-2 text-sm text-ink-muted"><ArrowLeft className="size-4" />{t("common.back")}</Link><h1 className="text-4xl font-semibold tracking-[-0.04em]">{t("practice.title")}</h1><p className="mt-3 text-ink-muted">{t("practice.description")}</p><div className="mt-8 rounded-[2rem] bg-brand-soft p-6"><div className="grid grid-cols-2 gap-2 rounded-2xl bg-surface/70 p-1"><Choice active={mode === "review"} onClick={() => setMode("review")} label={t("practice.review")} /><Choice active={mode === "questions"} onClick={() => setMode("questions")} label={t("practice.questions")} /></div><label className="mt-6 block"><span className="mb-2 block text-xs font-semibold text-ink-muted">{t("practice.set")}</span><select value={setId} onChange={(event) => setSetId(event.target.value)} className="h-11 w-full rounded-xl border bg-surface px-3"><option value="">{t("practice.allSets")}</option>{state.sets.map((entry) => <option key={entry.id} value={entry.id}>{entry.setName}</option>)}</select></label>{mode === "questions" && <div className="mt-4 grid gap-4 sm:grid-cols-2"><label><span className="mb-2 block text-xs font-semibold text-ink-muted">{t("practice.questionType")}</span><select value={questionType} onChange={(event) => setQuestionType(event.target.value as QuestionType)} className="h-11 w-full rounded-xl border bg-surface px-3"><option value="all">{t("practice.allQuestionTypes")}</option><option value="standard">{t("questions.standard")}</option><option value="fillBlank">{t("questions.fillBlank")}</option><option value="reading">{t("questions.reading")}</option></select></label><label><span className="mb-2 block text-xs font-semibold text-ink-muted">{t("practice.difficulty")}</span><select value={difficulty} onChange={(event) => setDifficulty(event.target.value as typeof difficulty)} className="h-11 w-full rounded-xl border bg-surface px-3"><option value="all">{t("practice.allDifficulties")}</option>{[1,2,3].map((value) => <option key={value} value={value}>{t("questions.difficulty", { level: value })}</option>)}</select></label></div>}<label className="mt-4 block"><span className="mb-2 block text-xs font-semibold text-ink-muted">{t("practice.amount")}</span><select value={amount} onChange={(event) => setAmount(Number(event.target.value))} className="h-11 w-full rounded-xl border bg-surface px-3">{[5,10,20,30].map((value) => <option key={value}>{value}</option>)}</select></label><Button className="mt-7 w-full" disabled={(mode === "review" ? reviewItems : questionItems).length === 0} onClick={() => setStarted(true)}>{(mode === "review" ? reviewItems : questionItems).length === 0 ? t("practice.noContent") : t("practice.begin")}</Button></div></div>;
  if (complete) return <ResultPanel correct={correct} total={total} skipped={skipped.length} marked={marked.length} wrongContent={wrongContent} onRetry={() => { if (mode === "review") setRetryReviews(wrong.map((value) => activeReviews[value]).filter(Boolean)); else setRetryQuestions(wrong.map((value) => activeQuestions[value]).filter(Boolean)); setIndex(0); setCorrect(0); setWrong([]); setSkipped([]); setMarked([]); }} onRetryMarked={marked.length ? () => { if (mode === "review") setRetryReviews(marked.map((value) => activeReviews[value]).filter(Boolean)); else setRetryQuestions(marked.map((value) => activeQuestions[value]).filter(Boolean)); setIndex(0); setCorrect(0); setWrong([]); setSkipped([]); setMarked([]); } : undefined} onContinueQuestions={mode === "review" && questionItems.length ? () => { setMode("questions"); setRetryReviews(null); setRetryQuestions(null); setIndex(0); setCorrect(0); setWrong([]); setSkipped([]); setMarked([]); } : undefined} />;

  return <div className="mx-auto max-w-3xl"><div className="mb-5 flex items-center justify-between text-sm text-ink-muted"><Link href="/practice">{t("common.back")}</Link><span>{t("practice.progress", { current: index + 1, total })}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${(index / total) * 100}%` }} /></div>{mode === "review" ? <ReviewCard item={activeReviews[index]} revealed={revealed} onReveal={() => setRevealed(true)} onRate={(rating) => void rate(rating)} /> : <><div className="mt-5 flex justify-end gap-2"><Button size="sm" variant={marked.includes(index) ? "secondary" : "ghost"} onClick={toggleMark}><Bookmark className="size-4" />{t("practice.mark")}</Button>{selected === null && <Button size="sm" variant="ghost" onClick={() => void skip()}><SkipForward className="size-4" />{t("practice.skip")}</Button>}</div><QuestionCard item={activeQuestions[index]} selected={selected} onAnswer={(choice) => void answer(choice)} onNext={next} /></>}</div>;
}

function Choice({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) { return <button onClick={onClick} className={`rounded-xl px-3 py-3 text-sm font-semibold ${active ? "bg-brand text-white shadow-sm" : "text-ink-muted"}`}>{label}</button>; }
function ReviewCard({ item, revealed, onReveal, onRate }: { item: StudyWord; revealed: boolean; onReveal: () => void; onRate: (rating: ReviewRating) => void }) { return <section className="mt-8 rounded-[2rem] bg-brand-soft px-6 py-12 text-center"><button aria-label={t("practice.speak")} onClick={() => speechSynthesis.speak(new SpeechSynthesisUtterance(item.word))} className="mx-auto mb-5 grid size-11 place-items-center rounded-full bg-surface text-brand"><Volume2 className="size-5" /></button><h1 className="text-5xl font-semibold tracking-[-0.045em]">{item.word}</h1><p className="mt-3 text-brand-strong">{item.pos}</p>{revealed ? <><div className="mx-auto my-8 h-px max-w-sm bg-brand/15" /><p className="text-2xl font-semibold">{item.meaning}</p>{item.example && <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-ink-muted">{item.example}</p>}<div className="mt-9 flex justify-center gap-3"><Button variant="secondary" onClick={() => onRate("again")}>{t("practice.again")}</Button><Button onClick={() => onRate("good")}>{t("practice.good")}</Button></div></> : <Button className="mt-10" onClick={onReveal}>{t("practice.reveal")}</Button>}</section>; }
function QuestionCard({ item, selected, onAnswer, onNext }: { item: QuestionItem; selected: number | null; onAnswer: (choice: number) => void; onNext: () => void }) { return <section className="mt-8 rounded-[2rem] bg-brand-soft p-6 sm:p-9">{item.question.kind === "reading" && <p className="mb-7 whitespace-pre-line rounded-2xl bg-surface/65 p-5 text-sm leading-7">{item.question.passage}</p>}<h1 className="text-xl font-semibold leading-8 sm:text-2xl">{item.prompt}</h1><div className="mt-7 grid gap-3">{item.options.map((option, index) => { const answered = selected !== null; const correct = index === item.answerIndex; return <button key={index} disabled={answered} onClick={() => onAnswer(index)} className={`min-h-12 rounded-2xl border px-4 py-3 text-left text-sm font-medium transition-colors ${answered && correct ? "border-brand bg-brand text-white" : answered && selected === index ? "border-red-300 bg-red-50 text-red-800" : "bg-surface hover:border-brand"}`}><span className="mr-3 text-ink-muted">{String.fromCharCode(65 + index)}</span>{option}</button>; })}</div>{selected !== null && <div className="mt-6"><p className="font-semibold text-brand-strong">{selected === item.answerIndex ? t("practice.correct") : t("practice.incorrect")}</p><p className="mt-1 text-sm text-ink-muted">{item.meaning}</p><Button className="mt-5" onClick={onNext}>{t("practice.next")}</Button></div>}</section>; }
function findMeaning(words: Record<string, WordEntry>, senseId: string) { return Object.values(words).flatMap((word) => word.senses).find((sense) => sense.id === senseId)?.meaningZh ?? ""; }

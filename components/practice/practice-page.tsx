"use client";

import type { LibraryQuestion, ReviewRating, StudyWord, WordEntry, WorkspacePracticeMode, WorkspaceQuestionDifficulty, WorkspaceQuestionType } from "@/types";
import { Bookmark, ListChecks, Plus, SkipForward, Sparkles, Volume2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { ResultPanel } from "@/components/practice/result-panel";
import { PRACTICE_PREFERENCES_STORAGE_KEY, PRACTICE_SESSION_STORAGE_KEY } from "@/constants";
import { t } from "@/lib/i18n";
import { useLearningStore } from "@/stores/learning-store";
import { useLibraryStore } from "@/stores/library-store";
import { isDue } from "@/src/lib/fsrs";
import { senseToStudyWord } from "@/src/lib/library";
import { allocateDailyQuestionQuotas } from "@/src/lib/question-distribution";
import { isSameLocalDay } from "@/src/lib/date";
import { parsePracticeSession } from "@/src/lib/practice-session";

type Mode = WorkspacePracticeMode;
type QuestionType = WorkspaceQuestionType;
type Difficulty = WorkspaceQuestionDifficulty;
interface QuestionItem { id: string; question: LibraryQuestion; prompt: string; options: string[]; answerIndex: number; senseId: string; type: "standard" | "fillBlank" | "reading"; difficulty: 1 | 2 | 3; meaning: string }

export function PracticePage({ initialMode = "review", initialSet = "" }: { initialMode?: Mode; initialSet?: string }) {
  const { state, status } = useLibraryStore();
  const learning = useLearningStore();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [setId, setSetId] = useState(initialSet);
  const [amount, setAmount] = useState(10);
  const [questionType, setQuestionType] = useState<QuestionType>("all");
  const [difficulty, setDifficulty] = useState<Difficulty>("all");
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState<number[]>([]);
  const [skipped, setSkipped] = useState<number[]>([]);
  const [marked, setMarked] = useState<number[]>([]);
  const [sessionQuestions, setSessionQuestions] = useState<QuestionItem[] | null>(null);
  const [sessionReviews, setSessionReviews] = useState<StudyWord[] | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [questionFailedSenses, setQuestionFailedSenses] = useState<string[]>([]);
  const restoreAttempted = useRef(false);
  const sessionRestored = useRef(false);
  const actionPending = useRef(false);

  const allowedSenseIds = useMemo(() => new Set((setId ? state.memberships[setId] ?? [] : Object.values(state.memberships).flat()).flatMap((entry) => entry.senseIds)), [setId, state.memberships]);
  const studyItems = useMemo(() => Object.values(state.words).flatMap((word) => word.senses.filter((sense) => allowedSenseIds.has(sense.id)).map((sense) => senseToStudyWord(word, sense))), [allowedSenseIds, state.words]);
  const allStudyItems = useMemo(() => Object.values(state.words).flatMap((word) => word.senses.map((sense) => senseToStudyWord(word, sense))), [state.words]);
  const reviewItems = useMemo(() => {
    const due = studyItems.filter((item) => learning.progress.cards[item.id] && isDue(learning.progress.cards[item.id])).sort((a, b) => new Date(learning.progress.cards[a.id].due).getTime() - new Date(learning.progress.cards[b.id].due).getTime());
    const fresh = studyItems.filter((item) => !learning.progress.cards[item.id]);
    const freshLimit = due.length ? Math.ceil(amount / 3) : amount;
    return [...due.slice(0, amount - Math.min(freshLimit, fresh.length)), ...fresh.slice(0, freshLimit)].slice(0, amount);
  }, [amount, learning.progress.cards, studyItems]);
  const allQuestionGroups = useMemo(() => state.questions.map((question): QuestionItem[] => {
    if (question.kind === "reading") return question.questions.map((child) => ({ id: `reading:${question.id}:${child.id}`, question, prompt: child.prompt, options: child.options, answerIndex: child.answerIndex, senseId: child.senseId, type: "reading", difficulty: question.difficulty, meaning: findMeaning(state.words, child.senseId) }));
    return [{ id: `question:${question.id}`, question, prompt: question.prompt, options: question.options, answerIndex: question.answerIndex, senseId: question.senseId, type: question.questionStyle, difficulty: question.difficulty, meaning: findMeaning(state.words, question.senseId) }];
  }), [state.questions, state.words]);
  const allQuestionItems = useMemo(() => allQuestionGroups.flat(), [allQuestionGroups]);
  const questionItems = useMemo(() => {
    const groups = allQuestionGroups.map((group) => group.filter((item) => allowedSenseIds.has(item.senseId))).filter((group) => group.length > 0 && (questionType === "all" || group[0]?.type === questionType) && (difficulty === "all" || group[0]?.difficulty === Number(difficulty)));
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
  }, [allQuestionGroups, allowedSenseIds, amount, difficulty, questionType]);
  const activeReviews = started ? sessionReviews ?? [] : reviewItems;
  const activeQuestions = started ? sessionQuestions ?? [] : questionItems;
  const total = mode === "review" ? activeReviews.length : activeQuestions.length;
  const complete = started && index >= total;
  const hasWords = Object.keys(state.words).length > 0;
  const wrongContent = wrong.length ? JSON.stringify({ items: wrong.map((value) => {
    if (mode === "review") {
      const item = activeReviews[value];
      return { type: "review", word: item?.word ?? "", pos: item?.pos ?? "", meaning: item?.meaning ?? "", example: item?.example ?? "" };
    }
    const item = activeQuestions[value];
    return { type: "question", questionType: item?.type ?? "standard", difficulty: item?.difficulty ?? 2, prompt: item?.prompt ?? "", options: item?.options ?? [], userAnswer: "答錯或跳過，未保存選項", correctAnswer: item?.options[item.answerIndex] ?? "", meaning: item?.meaning ?? "", ...(item?.question.kind === "reading" ? { passage: item.question.passage } : {}) };
  }) }, null, 2) : "";

  useEffect(() => {
    if (restoreAttempted.current || status !== "ready" || !learning.loaded) return;
    restoreAttempted.current = true;
    if (initialSet || initialMode !== "review") return;
    const raw = localStorage.getItem(PRACTICE_SESSION_STORAGE_KEY);
    const saved = parsePracticeSession(raw);
    if (!saved) {
      if (raw) localStorage.removeItem(PRACTICE_SESSION_STORAGE_KEY);
      return;
    }
    const allowed = new Set((saved.setId ? state.memberships[saved.setId] ?? [] : Object.values(state.memberships).flat()).flatMap((entry) => entry.senseIds));
    const sourceItems = saved.mode === "review" ? allStudyItems : allQuestionItems;
    const byId = new Map(sourceItems.map((item) => [item.id, item]));
    const items = saved.itemIds.map((id) => byId.get(id));
    if ((saved.setId && !state.sets.some((entry) => entry.id === saved.setId)) || items.some((item) => !item || !allowed.has(saved.mode === "review" ? (item as StudyWord).id : (item as QuestionItem).senseId))) {
      localStorage.removeItem(PRACTICE_SESSION_STORAGE_KEY);
      return;
    }
    sessionRestored.current = true;
    setMode(saved.mode); setSetId(saved.setId); setAmount(saved.amount); setIndex(saved.index); setCorrect(saved.correct); setWrong(saved.wrong); setSkipped(saved.skipped); setMarked(saved.marked); setSelected(saved.selected); setRevealed(saved.revealed); setQuestionType(saved.questionType); setDifficulty(saved.difficulty); setRetrying(saved.retrying); setQuestionFailedSenses(saved.failedSenseIds);
    if (saved.mode === "review") setSessionReviews(items as StudyWord[]); else setSessionQuestions(items as QuestionItem[]);
    setStarted(true);
  }, [allQuestionItems, allStudyItems, initialMode, initialSet, learning.loaded, state.memberships, state.sets, status]);
  useEffect(() => {
    if (!learning.loaded || started || sessionRestored.current) return;
    try {
      const saved = JSON.parse(localStorage.getItem(PRACTICE_PREFERENCES_STORAGE_KEY) ?? "{}") as { setId?: string; amount?: number; questionType?: QuestionType; difficulty?: Difficulty };
      if (!initialSet && saved.setId) setSetId(saved.setId);
      if (saved.amount) setAmount(saved.amount);
      if (saved.questionType) setQuestionType(saved.questionType);
      if (saved.difficulty) setDifficulty(saved.difficulty);
    } catch { /* use defaults */ }
  }, [initialSet, learning.loaded, started]);
  useEffect(() => {
    if (started) return;
    localStorage.setItem(PRACTICE_PREFERENCES_STORAGE_KEY, JSON.stringify({ setId, amount, questionType, difficulty }));
  }, [amount, difficulty, questionType, setId, started]);
  useEffect(() => {
    if (!started) return;
    if (complete) { localStorage.removeItem(PRACTICE_SESSION_STORAGE_KEY); return; }
    const itemIds = (mode === "review" ? activeReviews : activeQuestions).map((item) => item.id);
    if (!itemIds.length) return;
    localStorage.setItem(PRACTICE_SESSION_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, mode, setId, amount, index, correct, wrong, skipped, marked, selected, revealed, questionType, difficulty, itemIds, failedSenseIds: questionFailedSenses, retrying }));
  }, [activeQuestions, activeReviews, amount, complete, correct, difficulty, index, marked, mode, questionFailedSenses, questionType, retrying, revealed, selected, setId, skipped, started, wrong]);

  const next = () => { setIndex((value) => value + 1); setRevealed(false); setSelected(null); };
  const rate = async (rating: ReviewRating) => { const item = activeReviews[index]; if (!item || actionPending.current) return; actionPending.current = true; try { await learning.rateSense(item.id, rating); if (rating === "good") setCorrect((value) => value + 1); else setWrong((value) => [...value, index]); next(); } finally { actionPending.current = false; } };
  const answer = async (choice: number) => { if (selected !== null || actionPending.current) return; const item = activeQuestions[index]; if (!item) return; actionPending.current = true; try { const isCorrect = choice === item.answerIndex; setSelected(choice); setRevealed(true); if (isCorrect) setCorrect((value) => value + 1); else setWrong((value) => [...value, index]); const card = learning.progress.cards[item.senseId]; const reviewedToday = card?.lastReview ? isSameLocalDay(new Date(card.lastReview), new Date()) : false; if (!isCorrect && !questionFailedSenses.includes(item.senseId)) { setQuestionFailedSenses((values) => [...values, item.senseId]); await learning.scheduleSenseFromQuestion(item.senseId, "again"); } else if (isCorrect && !reviewedToday) await learning.scheduleSenseFromQuestion(item.senseId, "good"); await learning.recordQuestion(item.senseId, item.type, item.difficulty, isCorrect, retrying); } finally { actionPending.current = false; } };
  const skip = async () => { const item = activeQuestions[index]; if (!item || selected !== null || actionPending.current) return; actionPending.current = true; try { setSkipped((values) => [...values, index]); setWrong((values) => [...values, index]); await learning.recordQuestion(item.senseId, item.type, item.difficulty, false, retrying); next(); } finally { actionPending.current = false; } };
  const toggleMark = () => setMarked((values) => values.includes(index) ? values.filter((value) => value !== index) : [...values, index]);
  const begin = () => { if (mode === "review") { setSessionReviews(reviewItems); setSessionQuestions(null); } else { setSessionQuestions(questionItems); setSessionReviews(null); } setRetrying(false); setQuestionFailedSenses([]); setIndex(0); setCorrect(0); setWrong([]); setSkipped([]); setMarked([]); setSelected(null); setRevealed(false); setStarted(true); };
  const leave = () => { localStorage.removeItem(PRACTICE_SESSION_STORAGE_KEY); setStarted(false); setSessionReviews(null); setSessionQuestions(null); setRetrying(false); setQuestionFailedSenses([]); setIndex(0); setCorrect(0); setWrong([]); setSkipped([]); setMarked([]); setSelected(null); setRevealed(false); };

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

  if (status !== "ready" || !learning.loaded) return <div className="py-20 text-center text-sm text-muted-foreground">{t("library.loading")}</div>;
  if (!started) {
    const availableCount = mode === "review" ? reviewItems.length : questionItems.length;
    const emptyHref = !hasWords ? "/sets/new" : mode === "questions" ? "/questions/generate" : "/library";
    const emptyLabel = !hasWords ? t("practice.addWordsFirst") : mode === "questions" ? t("practice.generateFirst") : t("home.openLibrary");
    return <div><PageHeader title={t(mode === "review" ? "practice.review" : "practice.questions")} description={t("practice.description")} actions={mode === "questions" ? <><Button asChild variant="ghost"><Link href="/questions"><ListChecks className="size-4" />{t("practice.manageQuestions")}</Link></Button><Button asChild variant="secondary"><Link href="/questions/generate"><Sparkles className="size-4" />{t("questions.generate")}</Link></Button></> : undefined} /><div className="mx-auto max-w-xl"><div className="rounded-[2rem] bg-muted p-6"><div className="grid grid-cols-2 gap-2 rounded-2xl bg-card/70 p-1"><Choice active={mode === "review"} onClick={() => setMode("review")} label={t("practice.review")} /><Choice active={mode === "questions"} onClick={() => setMode("questions")} label={t("practice.questions")} /></div><label className="mt-6 block"><span className="mb-2 block text-xs font-semibold text-muted-foreground">{t("practice.set")}</span><select value={setId} onChange={(event) => setSetId(event.target.value)} className="h-11 w-full rounded-xl border bg-card px-3"><option value="">{t("practice.allSets")}</option>{state.sets.map((entry) => <option key={entry.id} value={entry.id}>{entry.setName}</option>)}</select></label>{mode === "questions" && <div className="mt-4 grid gap-4 sm:grid-cols-2"><label><span className="mb-2 block text-xs font-semibold text-muted-foreground">{t("practice.questionType")}</span><select value={questionType} onChange={(event) => setQuestionType(event.target.value as QuestionType)} className="h-11 w-full rounded-xl border bg-card px-3"><option value="all">{t("practice.allQuestionTypes")}</option><option value="standard">{t("questions.standard")}</option><option value="fillBlank">{t("questions.fillBlank")}</option><option value="reading">{t("questions.reading")}</option></select></label><label><span className="mb-2 block text-xs font-semibold text-muted-foreground">{t("practice.difficulty")}</span><select value={difficulty} onChange={(event) => setDifficulty(event.target.value as typeof difficulty)} className="h-11 w-full rounded-xl border bg-card px-3"><option value="all">{t("practice.allDifficulties")}</option>{[1,2,3].map((value) => <option key={value} value={value}>{t("questions.difficulty", { level: value })}</option>)}</select></label></div>}<label className="mt-4 block"><span className="mb-2 block text-xs font-semibold text-muted-foreground">{t("practice.amount")}</span><select value={amount} onChange={(event) => setAmount(Number(event.target.value))} className="h-11 w-full rounded-xl border bg-card px-3">{[5,10,20,30].map((value) => <option key={value}>{value}</option>)}</select></label><p className="mt-5 text-center text-sm font-medium text-foreground">{availableCount ? t(mode === "review" ? "practice.availableWords" : "practice.available", { count: availableCount }) : t("practice.noContent")}</p>{availableCount ? <Button className="mt-3 w-full" onClick={begin}>{t("practice.begin")}</Button> : <Button asChild className="mt-3 w-full"><Link href={emptyHref}>{!hasWords && <Plus className="size-4" />}{mode === "questions" && hasWords && <Sparkles className="size-4" />}{emptyLabel}</Link></Button>}</div></div></div>;
  }
  if (complete) return <ResultPanel correct={correct} total={total} skipped={skipped.length} marked={marked.length} wrongContent={wrongContent} onRetry={() => { if (mode === "review") setSessionReviews(wrong.map((value) => activeReviews[value]).filter(Boolean)); else setSessionQuestions(wrong.map((value) => activeQuestions[value]).filter(Boolean)); setRetrying(true); setQuestionFailedSenses([]); setIndex(0); setCorrect(0); setWrong([]); setSkipped([]); setMarked([]); setSelected(null); setRevealed(false); }} onRetryMarked={marked.length ? () => { if (mode === "review") setSessionReviews(marked.map((value) => activeReviews[value]).filter(Boolean)); else setSessionQuestions(marked.map((value) => activeQuestions[value]).filter(Boolean)); setRetrying(true); setQuestionFailedSenses([]); setIndex(0); setCorrect(0); setWrong([]); setSkipped([]); setMarked([]); setSelected(null); setRevealed(false); } : undefined} onContinueQuestions={mode === "review" && questionItems.length ? () => { setMode("questions"); setSessionReviews(null); setSessionQuestions(questionItems); setRetrying(false); setQuestionFailedSenses([]); setIndex(0); setCorrect(0); setWrong([]); setSkipped([]); setMarked([]); setSelected(null); setRevealed(false); } : undefined} />;

  return <div className="mx-auto max-w-3xl"><div className="mb-5 flex items-center justify-between text-sm text-muted-foreground"><button type="button" onClick={leave} className="hover:text-foreground">{t("common.back")}</button><span>{t("practice.progress", { current: index + 1, total })}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-border"><div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${(index / total) * 100}%` }} /></div>{mode === "review" ? <ReviewCard item={activeReviews[index]} revealed={revealed} onReveal={() => setRevealed(true)} onRate={(rating) => void rate(rating)} /> : <><div className="mt-5 flex justify-end gap-2"><Button size="sm" variant={marked.includes(index) ? "secondary" : "ghost"} onClick={toggleMark}><Bookmark className="size-4" />{t("practice.mark")}</Button>{selected === null && <Button size="sm" variant="ghost" onClick={() => void skip()}><SkipForward className="size-4" />{t("practice.skip")}</Button>}</div><QuestionCard item={activeQuestions[index]} selected={selected} onAnswer={(choice) => void answer(choice)} onNext={next} /></>}</div>;
}

function Choice({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) { return <button onClick={onClick} className={`rounded-xl px-3 py-3 text-sm font-semibold ${active ? "bg-primary text-white shadow-sm" : "text-muted-foreground"}`}>{label}</button>; }
function ReviewCard({ item, revealed, onReveal, onRate }: { item: StudyWord; revealed: boolean; onReveal: () => void; onRate: (rating: ReviewRating) => void }) { return <section className="mt-8 rounded-[2rem] bg-muted px-6 py-12 text-center"><button aria-label={t("practice.speak")} onClick={() => speechSynthesis.speak(new SpeechSynthesisUtterance(item.word))} className="mx-auto mb-5 grid size-11 place-items-center rounded-full bg-card text-primary"><Volume2 className="size-5" /></button><h1 className="text-5xl font-semibold tracking-[-0.045em]">{item.word}</h1><p className="mt-3 text-foreground">{item.pos}</p>{revealed ? <><div className="mx-auto my-8 h-px max-w-sm bg-primary/15" /><p className="text-2xl font-semibold">{item.meaning}</p>{item.example && <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-muted-foreground">{item.example}</p>}<div className="mt-9 flex justify-center gap-3"><Button variant="secondary" onClick={() => onRate("again")}>{t("practice.again")}</Button><Button onClick={() => onRate("good")}>{t("practice.good")}</Button></div></> : <Button className="mt-10" onClick={onReveal}>{t("practice.reveal")}</Button>}</section>; }
function QuestionCard({ item, selected, onAnswer, onNext }: { item: QuestionItem; selected: number | null; onAnswer: (choice: number) => void; onNext: () => void }) { return <section className="mt-8 rounded-[2rem] bg-muted p-6 sm:p-9">{item.question.kind === "reading" && <p className="mb-7 whitespace-pre-line rounded-2xl bg-card/65 p-5 text-sm leading-7">{item.question.passage}</p>}<h1 className="text-xl font-semibold leading-8 sm:text-2xl">{item.prompt}</h1><div className="mt-7 grid gap-3">{item.options.map((option, index) => { const answered = selected !== null; const correct = index === item.answerIndex; return <button key={index} disabled={answered} onClick={() => onAnswer(index)} className={`min-h-12 rounded-2xl border px-4 py-3 text-left text-sm font-medium transition-colors ${answered && correct ? "border-primary bg-primary text-white" : answered && selected === index ? "border-destructive/40 bg-destructive/10 text-destructive" : "bg-card hover:border-primary"}`}><span className="mr-3 text-muted-foreground">{String.fromCharCode(65 + index)}</span>{option}</button>; })}</div>{selected !== null && <div className="mt-6"><p className="font-semibold text-foreground">{selected === item.answerIndex ? t("practice.correct") : t("practice.incorrect")}</p><p className="mt-1 text-sm text-muted-foreground">{item.meaning}</p><Button className="mt-5" onClick={onNext}>{t("practice.next")}</Button></div>}</section>; }
function findMeaning(words: Record<string, WordEntry>, senseId: string) { return Object.values(words).flatMap((word) => word.senses).find((sense) => sense.id === senseId)?.meaningZh ?? ""; }

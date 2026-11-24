import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useQueries } from "@tanstack/react-query";
import { toast } from "sonner";
import { useNavigate } from "react-router";
import { useIsPresent } from "motion/react";
import { ArrowRight, ArrowCounterClockwise, CaretLeft, Check, X } from "@phosphor-icons/react";
import { calendarDay, descriptionPoints, normalizeWord, type PracticeTask } from "@lexiro/contract";
import { AnimatedNumber, AppLink, Button, HeaderButton, ProgressBar, Segmented, StepSlide, cn } from "design-kit";
import { errorMessage } from "@/data/api";
import { recordAnswer } from "@/data/learning";
import { starWords } from "@/data/library";
import { setQuery } from "@/data/queries";
import { isMarked, optionWord, promptWord, wordIndex, type SetWord } from "@/domain/marks";
import { clearRound, loadRound, saveRound } from "@/data/round-store";
import { TASK_LABELS } from "@/domain/labels";
import { isCustomStep, isRight, rightAnswerText, type Choice, type CustomStep } from "@/domain/custom";
import { passageParts, type PracticeItem, type Step } from "@/domain/practice";
import { acceptTyped, advance, choose, currentStep, finished, lookBack, newRound, result, usedBankOptions, type Round } from "@/domain/round";
import { CustomAnswer } from "./custom-answer";
import { useDocumentTitle } from "@/ui/title";
import { useScreen } from "@/ui/screen";
import { ScrollMore } from "@/ui/scroll-more";
import { SpeakButton } from "@/ui/speak";
import { StarMark } from "@/ui/star-button";

/** Starring during a round: set words star for good, other words only for this round's review. */
interface Marks { words: Map<string, SetWord>; marked: string[]; mark: (word: string, on: boolean) => void }
const MarksContext = createContext<Marks>({ words: new Map(), marked: [], mark: () => {} });

const isLatin = (text: string | undefined) => !!text && /[A-Za-z]/.test(text);
const latinProps = (text: string | undefined) => (isLatin(text) ? { className: "font-latin", lang: "en" } : {});
const kindLabel = (item: PracticeItem) => (item.kind === "custom" ? item.label : TASK_LABELS[item.kind as PracticeTask]);

function useSetWords(setIds: string[]) {
  const contents = useQueries({ queries: setIds.map((id) => setQuery(id, true)) });
  const stamp = contents.map((query) => query.dataUpdatedAt).join();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => wordIndex(contents.flatMap((query) => (query.data ? [query.data] : []))), [stamp]);
}

const WIDE = "(min-width: 768px)";
/** Room for the question beside its options (Tailwind's md). */
function useWide() {
  return useSyncExternalStore(
    (changed) => {
      const query = window.matchMedia?.(WIDE);
      query?.addEventListener("change", changed);
      return () => query?.removeEventListener("change", changed);
    },
    () => window.matchMedia?.(WIDE)?.matches ?? false,
  );
}

function useStarred(word: string) {
  const { words, marked } = useContext(MarksContext);
  const entry = words.get(normalizeWord(word));
  return entry ? entry.starred : isMarked(marked, word);
}

function MarkStar({ word, className }: { word: string; className?: string }) {
  const { words, mark } = useContext(MarksContext);
  const entry = words.get(normalizeWord(word));
  const starred = useStarred(word);
  return (
    <Button
      aria-label={starred ? `取消標星 ${word}` : `標星 ${word}`}
      aria-pressed={starred}
      className={cn("shrink-0", starred ? "text-highlight hover:text-highlight" : "text-ink-faint", className)}
      onClick={(event) => {
        event.stopPropagation();
        mark(word, !starred);
        if (entry) starWords(entry.setId, [entry.wordId], !starred).catch((reason) => { mark(word, starred); toast.error(errorMessage(reason)); });
      }}
      size="icon-sm"
      variant="ghost"
    >
      <StarMark starred={starred} />
    </Button>
  );
}

export default function RunPage() {
  const navigate = useNavigate();
  const [round, setRound] = useState<Round | null>(loadRound);
  useDocumentTitle("練習");
  useEffect(() => {
    if (!round) navigate("/app/practice", { replace: true });
    else if (!finished(round)) saveRound(round);
  }, [round, navigate]);
  const record = (current: Round, correct: boolean) => {
    const item = current.items[current.index];
    const step = item.steps[current.step];
    recordAnswer({ senseId: step.senseId, wordId: step.wordId, task: item.kind as PracticeTask, correct, day: calendarDay(new Date()) });
  };
  // A typed answer is recorded on moving on, so "我其實答對了" can still change it.
  const typed = (current: Round) => {
    const step = currentStep(current);
    return !!step && isCustomStep(step) && step.mode === "input";
  };
  // Answers are recorded from the latest round outside the state update, which must stay pure.
  const latest = useRef(round);
  useLayoutEffect(() => { latest.current = round; }, [round]);
  const pick = useCallback((option: Choice | null) => {
    const current = latest.current;
    if (!current || current.revealed || finished(current)) return;
    if (!typed(current)) record(current, isRight(currentStep(current)!, option));
    latest.current = choose(current, option);
    setRound((state) => (state ? choose(state, option) : state));
  }, []);
  const next = useCallback(() => {
    const current = latest.current;
    if (!current || finished(current) || !current.revealed) return;
    if (typed(current)) record(current, isRight(currentStep(current)!, current.choices[current.index][current.step]));
    latest.current = advance(current);
    setRound((state) => (state ? advance(state) : state));
  }, []);
  const accept = useCallback(() => setRound((current) => (current ? acceptTyped(current) : current)), []);
  const words = useSetWords(round?.setIds ?? []);
  const mark = useCallback((word: string, on: boolean) => setRound((current) => {
    if (!current) return current;
    const rest = (current.marked ?? []).filter((entry) => normalizeWord(entry) !== normalizeWord(word));
    return { ...current, marked: on ? [...rest, word] : rest };
  }), []);
  const marks = useMemo(() => ({ words, marked: round?.marked ?? [], mark }), [words, round?.marked, mark]);
  if (!round) return null;
  return (
    <MarksContext.Provider value={marks}>
      <StepSlide className="absolute inset-0 flex flex-col" direction={1} step={`${round.startedAt}:${finished(round)}`}>
        {finished(round)
          ? <Results onAgain={(items) => { const again = newRound(items, round.setIds); saveRound(again); setRound(again); }} round={round} />
          : <Card accept={accept} next={next} pick={pick} round={round} />}
      </StepSlide>
    </MarksContext.Provider>
  );
}

function Card({ round: live, pick, next: onward, accept }: { round: Round; pick: (option: Choice | null) => void; next: () => void; accept: () => void }) {
  // Answered steps can be looked at again, as they were answered.
  const [back, setBack] = useState(0);
  const round = lookBack(live, back);
  const first = round.index === 0 && round.step === 0;
  const next = useCallback(() => { if (back) setBack(back - 1); else onward(); }, [back, onward]);
  const item = round.items[round.index];
  const step = currentStep(round)!;
  const chosen = round.choices[round.index][round.step];
  const used = usedBankOptions(round);
  const { active } = useScreen();
  const present = useIsPresent();
  useEffect(() => {
    if (!active || !present) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || (event.target as HTMLElement).closest("input,textarea")) return;
      if (event.key === "ArrowLeft" && !first) { event.preventDefault(); setBack((value) => value + 1); return; }
      if (round.revealed && (event.key === "Enter" || event.key === " " || event.key === "ArrowRight")) { event.preventDefault(); next(); return; }
      const number = Number(event.key);
      const options = isCustomStep(step) ? (step.mode === "single" ? step.options : []) : step.options;
      if (!round.revealed && number >= 1 && number <= options.length && !used.has(number - 1)) pick(number - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, present, round.revealed, first, step, used, pick, next]);
  // Looking back brings the card in from the other side.
  const [place, setPlace] = useState({ index: round.index, back: false });
  if (place.index !== round.index) setPlace({ index: round.index, back: round.index < place.index });
  const progress = (round.index + (round.revealed ? 1 : 0)) / round.items.length;
  const last = !back && round.index + 1 === round.items.length && round.step + 1 === item.steps.length;
  return (
    // The round sits still on the screen; the question and answers scroll only when they are longer than it.
    <div className="mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col overscroll-none px-3 pb-[max(0.75rem,var(--safe-bottom))] pt-[calc(var(--safe-top)+0.5rem)] md:max-w-6xl md:px-6 md:pt-[calc(var(--safe-top)+1rem)]">
      <header className="flex items-center gap-3 px-1">
        <HeaderButton aria-label="離開練習（進度會保留）" asChild><AppLink back href="/app/practice"><X weight="bold" /></AppLink></HeaderButton>
        <HeaderButton aria-label="上一題" disabled={first} onClick={() => setBack(back + 1)}><CaretLeft weight="bold" /></HeaderButton>
        <ProgressBar className="flex-1" label="練習進度" value={progress} />
        <span className="font-latin text-sm tabular-nums text-ink-muted">{round.index + 1} / {round.items.length}</span>
        <Button className={cn(round.revealed && "pointer-events-none opacity-0")} inert={round.revealed} onClick={() => pick(null)} size="sm" variant="secondary">看答案</Button>
      </header>
      <StepSlide className="mx-[calc(50%-50vw)] flex min-h-0 flex-1 flex-col" direction={place.back ? -1 : 1} step={round.index}>
        <div className="mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col px-3 md:max-w-6xl md:px-6">
          <QuestionCard accept={back ? undefined : accept} chosen={chosen} item={item} last={last} next={next} pick={pick} round={round} step={step} used={used} />
        </div>
      </StepSlide>
    </div>
  );
}

/** One question with its answers; a card that has been moved on from stays as it was answered. */
function QuestionCard({ round, item, step, chosen, used, last, pick, next, accept }: {
  round: Round;
  item: PracticeItem;
  step: Step | CustomStep;
  chosen: Choice | null | undefined;
  used: Set<number>;
  last: boolean;
  pick: (option: Choice | null) => void;
  next: () => void;
  accept?: () => void;
}) {
  const wide = useWide();
  const page = useRef<HTMLDivElement>(null);
  const prompt = useRef<HTMLElement>(null);
  const answers = useRef<HTMLDivElement>(null);
  const question = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-ink-muted">
          {kindLabel(item)}
          {item.steps.length > 1 ? <span className="font-latin"> · {round.step + 1}/{item.steps.length}</span> : null}
        </p>
      </div>
      {item.kind === "custom"
        ? <CustomPrompt item={item} step={step as CustomStep} />
        : <Prompt chosen={chosen as number | null | undefined} item={item} round={round} step={step as Step} />}
    </>
  );
  const options = (
    <div className="message-in shrink-0" key={round.step}>
      {isCustomStep(step) && step.mode !== "single"
        ? <div className="rounded-[2rem] bg-surface p-3"><CustomAnswer chosen={chosen} revealed={round.revealed} step={step} submit={pick} /></div>
        : <Options chosen={chosen as number | null | undefined} pick={pick} revealed={round.revealed} step={step as Step} used={used} />}
    </div>
  );
  const feedback = round.revealed ? <Feedback accept={accept} chosen={chosen} item={item} step={step} /> : null;
  const nextBar = round.revealed ? (
    <div className="content-in shrink-0 max-md:pt-2">
      <Button autoFocus className="h-14 w-full rounded-[1.125rem]" onClick={next} size="lg" variant="solid">
        {last ? "看結果" : "下一題"}
        <kbd className="hidden rounded-[0.3rem] bg-canvas/15 px-1.5 py-0.5 font-mono text-[0.6875rem] font-medium md:inline">Enter</kbd>
      </Button>
    </div>
  ) : null;
  return (
    <>
      {wide ? (
        <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-[minmax(0,1fr)] gap-2 pt-4">
          <div className="relative min-h-0">
            <section className="flex h-full flex-col gap-3 overflow-y-auto overscroll-contain rounded-[2rem] bg-surface p-6" ref={prompt}>{question}</section>
            <ScrollMore className="absolute bottom-3 left-1/2 -translate-x-1/2" target={prompt} />
          </div>
          <div className="flex min-h-0 flex-col gap-2">
            <div className="relative min-h-0 flex-1">
              <div className="flex h-full flex-col gap-2 overflow-y-auto overscroll-contain" ref={answers}>{options}{feedback}</div>
              <ScrollMore className="absolute bottom-3 left-1/2 -translate-x-1/2" target={answers} />
            </div>
            {nextBar}
          </div>
        </div>
      ) : (
        <>
          <div className="relative min-h-0 flex-1">
            <div className="h-full overflow-y-auto overscroll-contain pt-3" ref={page}>
              {/* Once answered, the top of the feedback shows below the question. */}
              <div className={cn("flex flex-col gap-2 pb-2 transition-[min-height] duration-[var(--motion-control)] ease-[var(--ease-move)] motion-reduce:transition-none", round.revealed ? "min-h-[calc(100%-4.25rem)]" : "min-h-full")}>
                <section className="flex min-h-44 flex-auto flex-col gap-3 rounded-[2rem] bg-surface p-5">{question}</section>
                {options}
              </div>
              {feedback}
            </div>
            <ScrollMore className="absolute bottom-2 left-1/2 -translate-x-1/2" target={page} />
          </div>
          {nextBar}
        </>
      )}
    </>
  );
}

function Prompt({ item, step, round, chosen }: { item: PracticeItem; step: Step; round: Round; chosen: number | null | undefined }) {
  if (item.kind === "meaning" || item.kind === "reverse") {
    return (
      <div className="mt-auto grid gap-3">
        {item.kind === "meaning"
          ? <h1 className="break-words font-latin text-5xl font-semibold tracking-[-0.03em]" lang="en">{item.word}</h1>
          : <h1 className="text-4xl font-bold">{item.sense.meaning}</h1>}
        <div className="flex items-center gap-2 text-sm text-ink-muted">
          <span className="font-latin">{item.sense.pos}</span>
          <span className="ml-auto flex gap-1">
            {item.kind === "meaning" ? <SpeakButton text={item.word} /> : null}
            {item.kind === "meaning" || round.revealed ? <MarkStar word={item.word} /> : null}
          </span>
        </div>
      </div>
    );
  }
  if (item.kind === "vocabulary") {
    const [before, after] = step.prompt.split("_____");
    const filled = round.revealed ? step.options[step.answer] : null;
    return (
      <p className="font-latin text-xl leading-relaxed" lang="en">
        {before}
        <span className={cn("mx-1 inline-block min-w-20 rounded-chip border-b-2 px-2 text-center transition-colors duration-[var(--motion-control)]", filled ? "border-positive bg-positive/10 text-positive-ink" : "border-ink bg-surface-raised")}>{filled ?? " "}</span>
        {after}
      </p>
    );
  }
  // A passage: blanks before this one show what was picked, this one is highlighted.
  if (!("passage" in item) || item.kind === "custom") return null;
  const steps = item.steps;
  const answers = round.choices[round.index];
  return (
    <div className="grid gap-3">
      {item.title ? <h2 className="font-latin text-lg font-semibold" lang="en">{item.title}</h2> : null}
      <p className="whitespace-pre-line font-latin text-[1.0625rem] leading-[1.8]" lang="en">
        {passageParts(item.passage).map((part, index) => {
          if (typeof part === "string") return <span key={index}>{part}</span>;
          const at = steps.findIndex((entry) => entry.blank === part);
          const done = at < round.step || (at === round.step && round.revealed);
          const picked = done ? answers[at] : undefined;
          const right = done && picked === steps[at].answer;
          return (
            <span
              className={cn(
                "mx-0.5 inline-flex min-w-12 items-baseline justify-center rounded-chip px-1.5 text-[0.9375rem] font-semibold transition-colors duration-[var(--motion-control)]",
                at === round.step && !round.revealed ? "bg-ink text-canvas" : done ? (right ? "bg-positive/12 text-positive-ink" : "bg-danger/12 text-danger-ink") : "bg-surface-raised text-ink-muted",
              )}
              key={index}
            >
              {done ? (right ? steps[at].options[steps[at].answer] : `(${part}) ${steps[at].options[steps[at].answer]}`) : `(${part})`}
            </span>
          );
        })}
      </p>
      {item.kind === "reading" ? <p className="border-t border-line pt-3 font-latin text-lg font-medium leading-relaxed" lang="en">{step.prompt}</p> : null}
      {chosen === undefined && item.kind !== "reading" ? <p className="text-sm text-ink-muted">選出第 {step.blank} 格的答案</p> : null}
    </div>
  );
}

/** What an option stands for, shown once answered: part of speech and the word or meaning behind it. */
function Gloss({ step, index }: { step: Pick<Step, "glosses" | "poses">; index: number }) {
  const gloss = step.glosses?.[index];
  const pos = step.poses?.[index];
  if (!gloss) return null;
  return (
    <span className="message-in mt-0.5 block text-[0.8125rem] leading-snug text-ink-muted">
      {pos ? <span className="mr-1 font-latin">{pos}</span> : null}
      <span {...latinProps(gloss)}>{gloss}</span>
    </span>
  );
}

function Options({ step, chosen, revealed, used, pick }: { step: Pick<Step, "options" | "answer" | "glosses" | "poses">; chosen: number | null | undefined; revealed: boolean; used: Set<number>; pick: (option: number) => void }) {
  const wide = step.options.length > 4 || step.options.some((option) => option.length > 18);
  return (
    <div className={cn("grid gap-2", !wide && "grid-cols-2")} role="group" aria-label="選項">
      {step.options.map((option, index) => {
        const right = revealed && index === step.answer;
        const wrong = revealed && index === chosen && chosen !== step.answer;
        const word = revealed ? optionWord(step as Step, index) : undefined;
        return (
          <div className="relative min-w-0" key={index}>
            <button
              className={cn(
                "flex size-full rounded-[1.5rem] bg-surface px-4 py-3 text-left outline-none transition-[background-color,scale,opacity] duration-[var(--motion-control)] ease-[var(--ease-move)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:cursor-default",
                wide ? "min-h-16 items-center gap-3" : "min-h-24 flex-col justify-between gap-2",
                !revealed && "hover:bg-surface-solid hover:shadow-panel active:scale-[var(--motion-press-scale)]",
                right && "bg-positive/12",
                wrong && "bg-danger/10",
                revealed && !right && !wrong && "opacity-70",
                used.has(index) && !revealed && "opacity-35",
              )}
              disabled={revealed || used.has(index)}
              onClick={() => pick(index)}
              type="button"
            >
              <span
                aria-hidden
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-[0.45rem] font-mono text-xs transition-colors duration-[var(--motion-control)]",
                  right ? "text-base text-positive-ink" : wrong ? "text-base text-danger-ink" : "border border-line text-ink-muted",
                )}
              >
                {right ? <Check className="mark-in" key="right" weight="bold" /> : wrong ? <X className="mark-in" key="wrong" weight="bold" /> : index + 1}
              </span>
              <span className={cn("min-w-0", wide && "flex-1", word && "pr-7")}>
                <span className={cn("block text-lg font-semibold leading-snug transition-colors duration-[var(--motion-control)]", right && "text-positive-ink", wrong && "text-danger-ink", isLatin(option) && "font-latin tracking-[-0.01em]")} lang={isLatin(option) ? "en" : undefined}>{option}</span>
                {revealed ? <Gloss index={index} step={step} /> : null}
              </span>
            </button>
            {word ? <MarkStar className={cn("absolute right-1.5", wide ? "top-1/2 -translate-y-1/2" : "top-1.5")} word={word} /> : null}
          </div>
        );
      })}
    </div>
  );
}

function CustomPrompt({ item, step }: { item: Extract<PracticeItem, { kind: "custom" }>; step: CustomStep }) {
  return (
    <div className="grid gap-3">
      {item.instructions ? <p className="text-[0.9375rem] text-ink-muted">{item.instructions}</p> : null}
      {item.passage ? <div className="rounded-[1.25rem] bg-surface-raised px-4 py-3"><p className="whitespace-pre-line font-latin text-[1.0625rem] leading-[1.8]" lang="en">{item.passage}</p></div> : null}
      <p className={cn("leading-relaxed", isLatin(step.prompt) ? "font-latin text-xl" : "text-xl font-semibold")} lang={isLatin(step.prompt) ? "en" : undefined}>{step.prompt}</p>
    </div>
  );
}

/** Every option's reason for being wrong that the question carries, the picked one first. */
function reasonsFor(step: Step | CustomStep, chosen: Choice | null | undefined): { option: string; reason: string; picked: boolean }[] {
  if (isCustomStep(step) && step.mode !== "single" && step.mode !== "multiple") return [];
  const picked = new Set(typeof chosen === "number" ? [chosen] : Array.isArray(chosen) && isCustomStep(step) && step.mode === "multiple" ? chosen : []);
  return step.options
    .map((option, index) => ({ option, reason: step.whyWrong?.[option], picked: picked.has(index) }))
    .filter((entry): entry is { option: string; reason: string; picked: boolean } => !!entry.reason)
    .sort((a, b) => Number(b.picked) - Number(a.picked));
}

/** The explanation a step carries: the sense's notes and example for word tasks, the question's own otherwise. */
function hasExplanation(item: PracticeItem, step: Step | CustomStep, chosen: Choice | null | undefined) {
  if (item.kind === "meaning" || item.kind === "reverse") return !!item.sense.examples[0] || descriptionPoints(item.sense.description).length > 0;
  return !!step.explanation || reasonsFor(step, chosen).length > 0;
}

function Explanation({ item, step, chosen, brief = false }: { item: PracticeItem; step: Step | CustomStep; chosen: Choice | null | undefined; brief?: boolean }) {
  const reasons = reasonsFor(step, chosen);
  const word = item.kind === "meaning" || item.kind === "reverse";
  const notes = word ? descriptionPoints(item.sense.description) : [];
  const example = word ? item.sense.examples[0] : undefined;
  return (
    <>
      {word && !brief ? (
        <p className="text-[0.9375rem]"><span className="font-latin font-semibold" lang="en">{item.word}</span> <span className="font-latin text-ink-muted">{item.sense.pos}</span> {item.sense.meaning}</p>
      ) : null}
      {example ? <p className="rounded-[1rem] bg-surface-raised px-3.5 py-2.5 font-latin text-[0.9375rem] leading-relaxed" lang="en">{example}</p> : null}
      {notes.length ? <ul className="grid list-disc gap-1 pl-5 text-[0.9375rem] leading-relaxed text-ink-muted marker:text-ink-faint">{notes.map((note, index) => <li key={index}>{note}</li>)}</ul> : null}
      {step.explanation && !word ? <p className="whitespace-pre-line text-[0.9375rem] leading-relaxed text-ink-muted">{step.explanation}</p> : null}
      {reasons.length ? (
        <ul className="grid gap-1.5 text-[0.9375rem] leading-relaxed">
          {reasons.map(({ option, reason, picked }) => (
            <li key={option}>
              <span className={cn("font-semibold", picked ? "text-danger-ink" : "text-ink")} {...(isLatin(option) ? { lang: "en" } : {})}><span className={cn(isLatin(option) && "font-latin")}>{option}</span></span>
              <span className="text-ink-muted">：{reason}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

function Feedback({ item, step, chosen, accept }: { item: PracticeItem; step: Step | CustomStep; chosen: Choice | null | undefined; accept?: () => void }) {
  const right = isRight(step, chosen);
  const typedWrong = !right && typeof chosen === "string" && isCustomStep(step) && step.mode === "input";
  const answer = rightAnswerText(step);
  return (
    <div className="content-in grid shrink-0 gap-2.5 rounded-[2rem] bg-surface p-5" role="status">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2.5 font-semibold">
            <span aria-hidden className={cn("grid shrink-0 place-items-center text-lg", right ? "text-positive-ink" : "text-danger-ink")}>{right ? <Check weight="bold" /> : <X weight="bold" />}</span>
            {right ? "答對了" : <span>正確答案是 <span {...latinProps(answer)}>{answer}</span></span>}
          </p>
          {typedWrong && accept ? <Button onClick={accept} size="sm" variant="ghost">我其實答對了</Button> : null}
        </div>
        {typedWrong && isCustomStep(step) && step.mode === "input" && step.accepted.length > 1 ? <p className="font-latin text-[0.9375rem] text-ink-muted">{step.accepted.join(" / ")}</p> : null}
        <Explanation brief chosen={chosen} item={item} step={step} />
    </div>
  );
}

/** What the learner answered on a step, as text. */
function answeredText(step: Step | CustomStep, choice: Choice | null | undefined): string {
  if (choice === null || choice === undefined) return "沒作答";
  if (typeof choice === "string") return choice;
  const options = !isCustomStep(step) || step.mode === "single" || step.mode === "multiple" ? step.options : [];
  return (Array.isArray(choice) ? choice : [choice]).map((index) => options[index]).join("、");
}

/** What a wrongly picked option really stands for, when the round knows it. */
function pickedGloss(step: Step | CustomStep, choice: Choice | null | undefined): string | undefined {
  return typeof choice === "number" && !isCustomStep(step) ? step.glosses?.[choice] : undefined;
}

const duration = (from: string, to: number) => {
  const seconds = Math.max(0, Math.round((to - Date.parse(from)) / 1000));
  return seconds >= 3600 ? `${Math.floor(seconds / 3600)}:${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}` : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

type ReviewFilter = "missed" | "starred" | "all";

function Results({ round, onAgain }: { round: Round; onAgain: (items: PracticeItem[]) => void }) {
  const outcome = useMemo(() => result(round), [round]);
  const { words, marked } = useContext(MarksContext);
  const page = useRef<HTMLDivElement>(null);
  const [endedAt] = useState(() => Date.now());
  useEffect(() => clearRound(), []);
  const score = outcome.total ? Math.round((outcome.correct / outcome.total) * 100) : 0;
  const wrong = outcome.total - outcome.correct;
  const [filter, setFilter] = useState<ReviewFilter>(wrong ? "missed" : "all");
  const [switched, setSwitched] = useState(false);
  const steps = round.items.flatMap((item, index) => (item.steps as (Step | CustomStep)[]).map((step, at) => ({ item, step, key: `${index}-${at}`, at, choice: round.choices[index]?.[at] })));
  const shown = filter === "missed" ? steps.filter((entry) => !isRight(entry.step, entry.choice)) : steps;
  return (
    <div className="relative min-h-0 flex-1">
      <div className="h-full overflow-y-auto overscroll-contain" ref={page}>
        <div className="mx-auto grid w-full max-w-xl content-start gap-3 px-3 pb-[calc(var(--safe-bottom)+2.5rem)] pt-[calc(var(--safe-top)+1rem)] md:pt-[calc(var(--safe-top)+2.5rem)]">
          <section className="grid gap-4 rounded-[2rem] bg-ink p-5 text-canvas">
            <div>
              <p className="text-sm text-canvas/65">這一輪完成了</p>
              <p className="mt-1 font-latin text-[4.25rem] font-bold leading-none tracking-[-0.04em]"><AnimatedNumber value={score} /><span className="text-3xl text-canvas/55">%</span></p>
            </div>
            <dl className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-canvas/70">
              {[["答對", String(outcome.correct)], ["答錯", String(wrong)], ["標星", String(marked.length)], ["用時", duration(round.startedAt, endedAt)]].map(([label, value]) => (
                <div className="flex items-baseline gap-1" key={label}><dt className="order-2">{label}</dt><dd className="font-latin text-base font-semibold text-canvas">{value}</dd></div>
              ))}
            </dl>
            <div className="grid grid-cols-[1.4fr_1fr] gap-2">
              {outcome.missed.length ? (
                <Button className="bg-canvas text-ink hover:bg-canvas/90" onClick={() => onAgain(outcome.missed)} size="lg"><ArrowCounterClockwise weight="bold" />再練錯的 {outcome.missed.length} 題</Button>
              ) : null}
              <Button asChild className={cn(outcome.missed.length ? "bg-canvas/12 text-canvas hover:bg-canvas/20" : "col-span-2 bg-canvas text-ink hover:bg-canvas/90")} size="lg"><AppLink href="/app">完成<ArrowRight weight="bold" /></AppLink></Button>
            </div>
          </section>
          <Segmented<ReviewFilter>
            className="justify-self-start"
            label="復盤範圍"
            onChange={(next) => { setFilter(next); setSwitched(true); }}
            options={[
              ...(wrong ? [{ value: "missed" as const, label: `答錯 ${wrong}` }] : []),
              ...(marked.length ? [{ value: "starred" as const, label: `標星 ${marked.length}` }] : []),
              { value: "all", label: `全部 ${steps.length}` },
            ]}
            value={filter}
          />
          {filter === "starred" ? (
            <ul className="content-in grid rounded-[1.5rem] bg-surface px-2 py-1">
              {marked.map((word) => {
                const entry = words.get(normalizeWord(word));
                return (
                  <li className="flex items-center gap-2 border-t border-line py-1.5 pl-2 first:border-t-0" key={word}>
                    <span className="font-latin font-semibold" lang="en">{entry?.word ?? word}</span>
                    <span className="min-w-0 flex-1 truncate text-right text-[0.9375rem] text-ink-muted">{entry ? entry.meaning : "不在單字集，離開後不保留"}</span>
                    <MarkStar word={word} />
                  </li>
                );
              })}
            </ul>
          ) : (
            <ol className={cn("grid gap-2", switched && "content-in")} key={filter}>
              {shown.map(({ item, step, key, at, choice }) => <ReviewItem at={at} choice={choice} item={item} key={key} step={step} />)}
            </ol>
          )}
        </div>
      </div>
      <ScrollMore className="absolute bottom-[calc(var(--safe-bottom)+1rem)] left-1/2 -translate-x-1/2" target={page} />
    </div>
  );
}

function ReviewItem({ item, step, at, choice }: { item: PracticeItem; step: Step | CustomStep; at: number; choice: Choice | null | undefined }) {
  const right = isRight(step, choice);
  const answer = rightAnswerText(step);
  const word = promptWord(item, step);
  const wordTask = item.kind === "meaning" || item.kind === "reverse";
  const title = wordTask ? item.word : step.prompt || `${kindLabel(item)} 第 ${at + 1} 格`;
  const answered = answeredText(step, choice);
  const picked = pickedGloss(step, choice);
  const explained = hasExplanation(item, step, choice);
  const [open, setOpen] = useState(!right);
  return (
    <li className="grid gap-1.5 rounded-[1.5rem] bg-surface px-4 py-3.5">
      <div className="flex items-start gap-2.5">
        <span aria-label={right ? "答對" : "答錯"} className={cn("mt-1 grid size-5 shrink-0 place-items-center text-base", right ? "text-positive-ink" : "text-danger-ink")} role="img">{right ? <Check weight="bold" /> : <X weight="bold" />}</span>
        <button aria-expanded={explained ? open : undefined} className="min-w-0 flex-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:cursor-default" disabled={!explained} onClick={() => setOpen((value) => !value)} type="button">
          <span className={cn("leading-relaxed", wordTask ? "font-latin text-lg font-semibold tracking-[-0.01em]" : "text-[0.9375rem]", !wordTask && isLatin(title) && "font-latin")} lang={isLatin(title) ? "en" : undefined}>{title.replace("_____", "＿＿")}</span>
          {wordTask ? <span className="ml-1.5 font-latin text-sm text-ink-muted">{item.sense.pos}</span> : null}
        </button>
        {word ? <MarkStar className="-my-1.5 -mr-2" word={word} /> : null}
      </div>
      <div className="grid gap-1 pl-7.5">
        <p className="text-[0.9375rem]">
          {wordTask ? <span className="font-medium">{item.sense.meaning}</span> : <span className={cn("font-semibold text-positive-ink", isLatin(answer) && "font-latin")}>{answer}</span>}
        </p>
        {right ? null : (
          <p className="text-[0.8125rem] text-danger-ink">
            你的答案：<span className={cn(isLatin(answered) && "font-latin")}>{answered}</span>
            {picked ? <span className="text-ink-muted"> — 那是 <span className={cn(isLatin(picked) && "font-latin")}>{picked}</span></span> : null}
          </p>
        )}
        {explained ? (
          <div className="fold" data-open={open || undefined} inert={!open}>
            <div><div className="mt-1.5 grid gap-2 border-t border-line pt-2.5"><Explanation brief chosen={choice} item={item} step={step} /></div></div>
          </div>
        ) : null}
      </div>
    </li>
  );
}

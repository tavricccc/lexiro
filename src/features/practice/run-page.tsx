import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { toast } from "sonner";
import { useNavigate } from "react-router";
import { ArrowRight, ArrowCounterClockwise, Check, Star, X } from "@phosphor-icons/react";
import { calendarDay, descriptionPoints, normalizeWord, type PracticeTask, type SetContent } from "@lexiro/contract";
import { AnimatedNumber, AppLink, Button, Chip, HeaderButton, Panel, ProgressBar, cn } from "design-kit";
import { api, errorMessage } from "@/data/api";
import { recordAnswer } from "@/data/learning";
import { starWords } from "@/data/library";
import { keys } from "@/data/queries";
import { isMarked, optionWord, promptWord, wordIndex, type SetWord } from "@/domain/marks";
import { clearRound, loadRound, saveRound } from "@/data/round-store";
import { TASK_LABELS } from "@/domain/labels";
import { isCustomStep, isRight, rightAnswerText, type Choice, type CustomStep } from "@/domain/custom";
import { passageParts, type PracticeItem, type Step } from "@/domain/practice";
import { acceptTyped, advance, choose, currentStep, finished, newRound, result, usedBankOptions, type Round } from "@/domain/round";
import { CustomAnswer } from "./custom-answer";
import { useDocumentTitle } from "@/ui/title";
import { SpeakButton } from "@/ui/speak";

/** Starring during a round: set words star for good, other words only for this round's review. */
interface Marks { words: Map<string, SetWord>; marked: string[]; mark: (word: string, on: boolean) => void }
const MarksContext = createContext<Marks>({ words: new Map(), marked: [], mark: () => {} });

function useSetWords(setIds: string[]) {
  const contents = useQueries({ queries: setIds.map((id) => ({ queryKey: keys.set(id), queryFn: () => api<SetContent>(`/sets/${encodeURIComponent(id)}`) })) });
  const stamp = contents.map((query) => query.dataUpdatedAt).join();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => wordIndex(contents.flatMap((query) => (query.data ? [query.data] : []))), [stamp]);
}

function MarkStar({ word, className }: { word: string; className?: string }) {
  const { words, marked, mark } = useContext(MarksContext);
  const entry = words.get(normalizeWord(word));
  const starred = entry ? entry.starred : isMarked(marked, word);
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
      <Star weight={starred ? "fill" : "regular"} />
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
  const pick = useCallback((option: Choice | null) => {
    setRound((current) => {
      if (!current || current.revealed || finished(current)) return current;
      if (!typed(current)) record(current, isRight(currentStep(current)!, option));
      return choose(current, option);
    });
  }, []);
  const next = useCallback(() => setRound((current) => {
    if (!current) return current;
    if (current.revealed && typed(current)) record(current, isRight(currentStep(current)!, current.choices[current.index][current.step]));
    return advance(current);
  }), []);
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
      {finished(round)
        ? <Results onAgain={(items) => { const again = newRound(items, round.setIds); saveRound(again); setRound(again); }} round={round} />
        : <Card accept={accept} next={next} pick={pick} round={round} />}
    </MarksContext.Provider>
  );
}

function Card({ round, pick, next, accept }: { round: Round; pick: (option: Choice | null) => void; next: () => void; accept: () => void }) {
  const item = round.items[round.index];
  const step = currentStep(round)!;
  const chosen = round.choices[round.index][round.step];
  const used = usedBankOptions(round);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || (event.target as HTMLElement).closest("input,textarea")) return;
      if (round.revealed && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); next(); return; }
      const number = Number(event.key);
      const options = isCustomStep(step) ? (step.mode === "single" ? step.options : []) : step.options;
      if (!round.revealed && number >= 1 && number <= options.length && !used.has(number - 1)) pick(number - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [round.revealed, step, used, pick, next]);
  const progress = (round.index + (round.revealed ? 1 : 0)) / round.items.length;
  return (
    // The round sits still on the screen; only an overlong card scrolls inside itself.
    <div className="fixed inset-0 z-30 mx-auto flex w-full max-w-2xl flex-col overscroll-none px-[var(--gutter)] pb-[max(1.5rem,var(--safe-bottom))] pt-[calc(var(--safe-top)+0.5rem)] md:pt-[calc(var(--safe-top)+1rem)]">
      <header className="flex items-center gap-3">
        <HeaderButton aria-label="離開練習（進度會保留）" asChild><AppLink href="/app/practice"><X weight="bold" /></AppLink></HeaderButton>
        <ProgressBar className="flex-1" label="練習進度" value={progress} />
        <span className="font-latin text-sm tabular-nums text-ink-muted">{round.index + 1}/{round.items.length}</span>
      </header>
      <div className="card-in flex min-h-0 flex-1 flex-col" key={round.index}>
        {/* The question and its explanation scroll at the top; the answers stay put where a thumb rests. */}
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain pb-3 pt-6">
          <div className="flex items-center justify-between gap-2">
          <Chip>{item.kind === "custom" ? item.label : TASK_LABELS[item.kind as PracticeTask]}{item.steps.length > 1 ? ` · 第 ${round.step + 1}/${item.steps.length} ${item.kind === "custom" || item.kind === "reading" ? "題" : "格"}` : ""}</Chip>
            {round.revealed && item.kind !== "meaning" && item.kind !== "reverse" && promptWord(item, step) ? <MarkStar word={promptWord(item, step)!} /> : null}
          </div>
          {item.kind === "custom" ? <CustomPrompt item={item} step={step as CustomStep} /> : <Prompt chosen={chosen as number | null | undefined} item={item} round={round} step={step as Step} />}
          {round.revealed ? <div ref={(node) => node?.scrollIntoView?.({ block: "nearest", behavior: "smooth" })}><Feedback accept={accept} chosen={chosen} item={item} step={step} /></div> : null}
        </div>
        <div className="message-in shrink-0 pt-2" key={round.step}>
          {isCustomStep(step) && step.mode !== "single"
            ? <CustomAnswer chosen={chosen} revealed={round.revealed} step={step} submit={pick} />
            : <Options chosen={chosen as number | null | undefined} pick={pick} revealed={round.revealed} step={step as Step} used={used} />}
        </div>
      </div>
      <div className="flex shrink-0 justify-end gap-2 pt-3">
        {round.revealed ? (
          <Button autoFocus onClick={next} size="lg" variant="primary">{round.index + 1 === round.items.length && round.step + 1 === item.steps.length ? "看結果" : "下一題"}<ArrowRight weight="bold" /></Button>
        ) : (
          <Button onClick={() => pick(null)} size="lg" variant="ghost">不會，看答案</Button>
        )}
      </div>
    </div>
  );
}

function Prompt({ item, step, round, chosen }: { item: PracticeItem; step: Step; round: Round; chosen: number | null | undefined }) {
  if (item.kind === "meaning")
    return (
      <div className="grid gap-1 py-2">
        <p className="flex items-center gap-2 font-latin text-4xl font-bold tracking-tight md:text-5xl" lang="en">{item.word}<SpeakButton text={item.word} /><MarkStar word={item.word} /></p>
      </div>
    );
  if (item.kind === "reverse")
    return (
      <div className="grid gap-2 py-2">
        <p className="flex items-center gap-2 text-3xl font-bold md:text-4xl">{item.sense.meaning}<MarkStar word={item.word} /></p>
        <p className="text-sm text-ink-muted"><span className="font-latin">{item.sense.pos}</span> · 選出對應的英文單字</p>
      </div>
    );
  if (item.kind === "vocabulary") {
    const [before, after] = step.prompt.split("_____");
    const filled = round.revealed ? step.options[step.answer] : null;
    return (
      <p className="py-2 font-latin text-[1.0625rem] leading-relaxed" lang="en">
        {before}
        <span className={cn("mx-1 inline-block min-w-20 rounded-chip border-b-2 px-2 text-center", filled ? "border-positive bg-positive/10 text-positive" : "border-contrast bg-accent-soft")}>{filled ?? " "}</span>
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
      <Panel>
        {item.title ? <h2 className="mb-2 font-latin text-lg font-semibold" lang="en">{item.title}</h2> : null}
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
                  "mx-0.5 inline-flex min-w-12 items-baseline justify-center rounded-chip px-1.5 text-[0.9375rem] font-semibold",
                  at === round.step && !round.revealed ? "bg-contrast text-on-contrast" : done ? (right ? "bg-positive/12 text-positive" : "bg-danger/12 text-danger") : "bg-surface-raised text-ink-muted",
                )}
                key={index}
              >
                {done ? (right ? steps[at].options[steps[at].answer] : `(${part}) ${steps[at].options[steps[at].answer]}`) : `(${part})`}
              </span>
            );
          })}
        </p>
      </Panel>
      {item.kind === "reading" ? <p className="font-latin text-lg font-medium leading-relaxed" lang="en">{step.prompt}</p> : null}
      {chosen === undefined && item.kind !== "reading" ? <p className="text-sm text-ink-muted">選出第 {step.blank} 格的答案</p> : null}
    </div>
  );
}

function Options({ step, chosen, revealed, used, pick }: { step: Pick<Step, "options" | "answer" | "glosses">; chosen: number | null | undefined; revealed: boolean; used: Set<number>; pick: (option: number) => void }) {
  const long = step.options.some((option) => option.length > 24);
  return (
    <div className={cn("grid gap-2", !long && step.options.length <= 4 && "sm:grid-cols-2")} role="group" aria-label="選項">
      {step.options.map((option, index) => {
        const right = revealed && index === step.answer;
        const wrong = revealed && index === chosen && chosen !== step.answer;
        const word = revealed ? optionWord(step as Step, index) : undefined;
        return (
          <div className="relative" key={index}>
          <button
            className={cn(
              "flex min-h-14 items-center gap-3 rounded-tile border px-4 py-3 text-left text-base outline-none transition-[background-color,border-color,transform] duration-[var(--motion-control)] ease-[var(--ease-move)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:cursor-default",
              !revealed && "border-line bg-surface hover:bg-surface-raised active:scale-[var(--motion-press-scale)]",
              right && "border-positive bg-positive/12",
              wrong && "border-danger bg-danger/12",
              revealed && !right && !wrong && "border-line bg-surface opacity-60",
              used.has(index) && !revealed && "opacity-35",
            )}
            disabled={revealed || used.has(index)}
            onClick={() => pick(index)}
            type="button"
          >
            <span aria-hidden className={cn("grid size-7 shrink-0 place-items-center rounded-full text-sm font-semibold", right ? "bg-positive text-white" : wrong ? "bg-danger text-white" : "bg-surface-raised text-ink-muted")}>
              {right ? <Check weight="bold" /> : wrong ? <X weight="bold" /> : index + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className={cn("block", /[A-Za-z]/.test(option) && "font-latin")} lang={/[A-Za-z]/.test(option) ? "en" : undefined}>{option}</span>
              {revealed && step.glosses?.[index] ? <span className={cn("message-in block text-[0.8125rem] text-ink-muted", /[A-Za-z]/.test(step.glosses[index]!) && "font-latin")} lang={/[A-Za-z]/.test(step.glosses[index]!) ? "en" : undefined}>{step.glosses[index]}</span> : null}
            </span>
            {word ? <span aria-hidden className="size-8 shrink-0" /> : null}
          </button>
          {word ? <MarkStar className="absolute right-2 top-1/2 -translate-y-1/2" word={word} /> : null}
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
      {item.passage ? <Panel className="max-h-[40svh] overflow-y-auto"><p className="whitespace-pre-line font-latin text-[1.0625rem] leading-[1.8]" lang="en">{item.passage}</p></Panel> : null}
      <p className={cn("leading-relaxed", /[A-Za-z]/.test(step.prompt) ? "font-latin text-xl md:text-2xl" : "text-xl font-semibold")} lang={/[A-Za-z]/.test(step.prompt) ? "en" : undefined}>{step.prompt}</p>
    </div>
  );
}

/** Reasons for the wrong options picked: one for a single choice, every wrong pick of a multiple one. */
function reasonsFor(step: Step | CustomStep, chosen: Choice | null | undefined): string[] {
  const options = !isCustomStep(step) || step.mode === "single" || step.mode === "multiple" ? step.options : [];
  const whyWrong = !isCustomStep(step) || step.mode === "single" || step.mode === "multiple" ? step.whyWrong : undefined;
  const picked = typeof chosen === "number" ? [chosen] : Array.isArray(chosen) && isCustomStep(step) && step.mode === "multiple" ? chosen : [];
  return picked.map((index) => whyWrong?.[options[index]]).filter((reason): reason is string => !!reason && !isRight(step, chosen));
}

function Feedback({ item, step, chosen, accept }: { item: PracticeItem; step: Step | CustomStep; chosen: Choice | null | undefined; accept: () => void }) {
  const right = isRight(step, chosen);
  const reasons = reasonsFor(step, chosen);
  const notes = item.kind === "meaning" || item.kind === "reverse" ? descriptionPoints(item.sense.description) : [];
  const typedWrong = !right && typeof chosen === "string" && isCustomStep(step) && step.mode === "input";
  const answer = rightAnswerText(step);
  return (
    <div className="message-in grid gap-2 rounded-tile border border-line bg-surface px-4 py-3" role="status">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={cn("flex items-center gap-2 font-semibold", right ? "text-positive" : "text-danger")}>
          {right ? <Check weight="bold" /> : <X weight="bold" />}
          {right ? "答對了" : <>正確答案是 <span className={cn(/[A-Za-z]/.test(answer) && "font-latin")}>{answer}</span></>}
        </p>
        {typedWrong ? <Button onClick={accept} size="sm" variant="ghost">我其實答對了</Button> : null}
      </div>
      {typedWrong && isCustomStep(step) && step.mode === "input" && step.accepted.length > 1 ? <p className="font-latin text-[0.9375rem] text-ink-muted">{step.accepted.join(" / ")}</p> : null}
      {item.kind === "meaning" || item.kind === "reverse" ? (
        <p className="text-[0.9375rem]"><span className="font-latin font-semibold">{item.word}</span> <span className="font-latin text-ink-muted">{item.sense.pos}</span> {item.sense.meaning}</p>
      ) : null}
      {reasons.map((reason) => <p className="text-[0.9375rem] text-ink-muted" key={reason}>{reason}</p>)}
      {step.explanation && item.kind !== "meaning" && item.kind !== "reverse" ? <p className="text-[0.9375rem] leading-relaxed text-ink-muted">{step.explanation}</p> : null}
      {notes.length ? <ul className="grid list-disc gap-1 pl-5 text-[0.9375rem] text-ink-muted marker:text-ink-faint">{notes.map((note, index) => <li key={index}>{note}</li>)}</ul> : null}
      {item.kind === "meaning" || item.kind === "reverse" ? item.sense.examples.slice(0, 1).map((example) => (
        <p className="font-latin text-[0.9375rem] italic text-ink-muted" key={example} lang="en">{example}</p>
      )) : null}
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

const textClass = (text: string) => (/[A-Za-z]/.test(text) ? "font-latin" : undefined);

function Results({ round, onAgain }: { round: Round; onAgain: (items: PracticeItem[]) => void }) {
  const outcome = useMemo(() => result(round), [round]);
  const { words, marked } = useContext(MarksContext);
  useEffect(() => clearRound(), []);
  const score = outcome.total ? Math.round((outcome.correct / outcome.total) * 100) : 0;
  return (
    <div className="mx-auto grid w-full max-w-xl content-start gap-6 px-[var(--gutter)] pb-[calc(var(--safe-bottom)+2.5rem)] pt-[calc(var(--safe-top)+2.5rem)]">
      <div className="content-in grid justify-items-center gap-2 text-center">
        <p className="text-sm font-medium text-ink-muted">這一輪完成了</p>
        <p className="font-latin text-7xl font-extrabold tracking-tight text-contrast"><AnimatedNumber value={score} />%</p>
        <p className="text-[0.9375rem] text-ink-muted">答對 <span className="font-latin font-semibold text-ink">{outcome.correct}</span> / <span className="font-latin">{outcome.total}</span></p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {outcome.missed.length ? <Button onClick={() => onAgain(outcome.missed)} size="lg" variant="primary"><ArrowCounterClockwise weight="bold" />再練錯的 {outcome.missed.length} 題</Button> : null}
        <Button asChild size="lg" variant={outcome.missed.length ? "secondary" : "primary"}><AppLink href="/app">完成</AppLink></Button>
      </div>
      {marked.length ? (
        <Panel className="grid gap-1">
          <h2 className="text-sm font-semibold text-ink-muted">這輪標星的</h2>
          <ul className="grid">
            {marked.map((word) => {
              const entry = words.get(normalizeWord(word));
              return (
                <li className="flex items-center gap-2 py-1 text-[0.9375rem]" key={word}>
                  <span className="font-latin font-semibold" lang="en">{entry?.word ?? word}</span>
                  <span className="min-w-0 flex-1 truncate text-ink-muted">{entry ? entry.meaning : "不在單字集，離開後不保留"}</span>
                  <MarkStar word={word} />
                </li>
              );
            })}
          </ul>
        </Panel>
      ) : null}
      <section className="grid gap-2">
        <h2 className="text-sm font-semibold text-ink-muted">復盤</h2>
        <ol className="grid gap-2">
          {round.items.map((item, index) => (
            (item.steps as (Step | CustomStep)[]).map((step, at) => {
              const choice = round.choices[index]?.[at];
              const right = isRight(step, choice);
              const answer = rightAnswerText(step);
              const word = promptWord(item, step);
              const title = item.kind === "meaning" ? item.word : item.kind === "reverse" ? item.sense.meaning : step.prompt || `${item.kind === "custom" ? item.label : TASK_LABELS[item.kind as PracticeTask]} 第 ${at + 1} 格`;
              return (
                <li className={cn("grid gap-1 rounded-tile border px-4 py-3", right ? "border-line bg-surface" : "border-danger/40 bg-danger/6")} key={`${index}-${at}`}>
                  <div className="flex items-start gap-2">
                    <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-xs text-white", right ? "bg-positive" : "bg-danger")}>{right ? <Check weight="bold" /> : <X weight="bold" />}</span>
                    <p className={cn("min-w-0 flex-1 text-[0.9375rem] leading-relaxed", textClass(title))} lang={textClass(title) ? "en" : undefined}>{title.replace("_____", "＿＿")}</p>
                    {word ? <MarkStar className="-my-1" word={word} /> : null}
                  </div>
                  <p className="pl-7 text-[0.9375rem]">
                    <span className={cn("font-semibold text-positive", textClass(answer))}>{answer}</span>
                    {item.kind === "meaning" || item.kind === "reverse" ? <span className="text-ink-muted"> · <span className="font-latin">{item.sense.pos}</span></span> : null}
                  </p>
                  {right ? null : <p className="pl-7 text-[0.8125rem] text-ink-muted">你的答案：<span className={textClass(answeredText(step, choice))}>{answeredText(step, choice)}</span></p>}
                </li>
              );
            })
          ))}
        </ol>
      </section>
    </div>
  );
}

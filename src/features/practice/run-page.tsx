import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowRight, ArrowCounterClockwise, Check, X } from "@phosphor-icons/react";
import { calendarDay, descriptionPoints, type PracticeTask } from "@lexiro/contract";
import { AnimatedNumber, AppLink, Button, Chip, HeaderButton, Panel, ProgressBar, cn } from "design-kit";
import { recordAnswer } from "@/data/learning";
import { clearRound, loadRound, saveRound } from "@/data/round-store";
import { TASK_LABELS } from "@/domain/labels";
import { isCustomStep, isRight, rightAnswerText, type Choice, type CustomStep } from "@/domain/custom";
import { passageParts, type PracticeItem, type Step } from "@/domain/practice";
import { acceptTyped, advance, choose, currentStep, finished, newRound, result, usedBankOptions, type Round } from "@/domain/round";
import { CustomAnswer } from "./custom-answer";
import { useDocumentTitle } from "@/ui/title";
import { SpeakButton } from "@/ui/speak";

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
  if (!round) return null;
  if (finished(round)) return <Results onAgain={(items) => { const again = newRound(items, round.setIds); saveRound(again); setRound(again); }} round={round} />;
  return <Card accept={accept} next={next} pick={pick} round={round} />;
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
    <div className="fixed inset-0 z-30 mx-auto flex w-full max-w-2xl flex-col overscroll-none px-[var(--gutter)] pb-[max(1.5rem,var(--safe-bottom))] pt-[calc(var(--safe-top)+0.5rem)] md:pt-4">
      <header className="flex items-center gap-3">
        <HeaderButton aria-label="離開練習（進度會保留）" asChild><AppLink href="/app/practice"><X weight="bold" /></AppLink></HeaderButton>
        <ProgressBar className="flex-1" label="練習進度" value={progress} />
        <span className="font-latin text-sm tabular-nums text-ink-muted">{round.index + 1}/{round.items.length}</span>
      </header>
      <div className="card-in flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain pt-6" key={round.index}>
        <Chip className="self-start">{item.kind === "custom" ? item.label : TASK_LABELS[item.kind as PracticeTask]}{item.steps.length > 1 ? ` · 第 ${round.step + 1}/${item.steps.length} ${item.kind === "custom" || item.kind === "reading" ? "題" : "格"}` : ""}</Chip>
        <div className="flex flex-1 flex-col justify-center">
          {item.kind === "custom" ? <CustomPrompt item={item} step={step as CustomStep} /> : <Prompt chosen={chosen as number | null | undefined} item={item} round={round} step={step as Step} />}
        </div>
        {/* Choices sit low, where a thumb rests; a long card still scrolls from the top. */}
        <div className="message-in mt-auto" key={round.step}>
          {isCustomStep(step) && step.mode !== "single"
            ? <CustomAnswer chosen={chosen} revealed={round.revealed} step={step} submit={pick} />
            : <Options chosen={chosen as number | null | undefined} pick={pick} revealed={round.revealed} step={step as Step} used={used} />}
        </div>
        {round.revealed ? <Feedback accept={accept} chosen={chosen} item={item} step={step} /> : null}
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
      <div className="grid gap-1 py-6 text-center">
        <p className="flex items-center justify-center gap-2 font-latin text-4xl font-bold tracking-tight md:text-5xl" lang="en">{item.word}<SpeakButton text={item.word} /></p>
      </div>
    );
  if (item.kind === "reverse")
    return (
      <div className="grid gap-2 py-6 text-center">
        <p className="text-3xl font-bold md:text-4xl">{item.sense.meaning}</p>
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
      <Panel className="max-h-[45svh] overflow-y-auto">
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
        return (
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
            key={index}
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
          </button>
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
    <Panel className="message-in grid gap-2" role="status">
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
    </Panel>
  );
}

function Results({ round, onAgain }: { round: Round; onAgain: (items: PracticeItem[]) => void }) {
  const outcome = useMemo(() => result(round), [round]);
  useEffect(() => clearRound(), []);
  const score = outcome.total ? Math.round((outcome.correct / outcome.total) * 100) : 0;
  return (
    <div className="mx-auto grid min-h-svh w-full max-w-xl content-center gap-8 px-[var(--gutter)] py-10">
      <div className="content-in grid justify-items-center gap-2 text-center">
        <p className="text-sm font-medium text-ink-muted">這一輪完成了</p>
        <p className="font-latin text-7xl font-extrabold tracking-tight text-contrast"><AnimatedNumber value={score} />%</p>
        <p className="text-[0.9375rem] text-ink-muted">答對 <span className="font-latin font-semibold text-ink">{outcome.correct}</span> / <span className="font-latin">{outcome.total}</span></p>
      </div>
      {outcome.missed.length ? (
        <Panel className="grid gap-2">
          <h2 className="text-sm font-semibold text-ink-muted">要再看看的</h2>
          <ul className="grid gap-1.5">
            {outcome.missed.slice(0, 8).map((item, index) => (
              <li className="text-[0.9375rem]" key={index}>
                {item.kind === "meaning" || item.kind === "reverse"
                  ? <><span className="font-latin font-semibold">{item.word}</span> <span className="text-ink-muted">{item.sense.meaning}</span></>
                  : <span className="text-ink-muted">{item.kind === "custom" ? item.label : TASK_LABELS[item.kind as PracticeTask]}：{(item.steps as (Step | CustomStep)[]).map(rightAnswerText).join("、")}</span>}
              </li>
            ))}
          </ul>
        </Panel>
      ) : <p className="text-center text-lg font-semibold text-positive">全對，太強了！</p>}
      <div className="grid gap-2 sm:grid-cols-2">
        {outcome.missed.length ? <Button onClick={() => onAgain(outcome.missed)} size="lg" variant="primary"><ArrowCounterClockwise weight="bold" />再練錯的 {outcome.missed.length} 題</Button> : null}
        <Button asChild size="lg" variant={outcome.missed.length ? "secondary" : "primary"}><AppLink href="/app">完成</AppLink></Button>
      </div>
    </div>
  );
}

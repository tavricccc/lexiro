import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowRight, ArrowCounterClockwise, Check, X } from "@phosphor-icons/react";
import { calendarDay, descriptionPoints, type PracticeTask } from "@lexiro/contract";
import { AnimatedNumber, AppLink, Button, Chip, HeaderButton, Panel, ProgressBar, cn } from "design-kit";
import { recordAnswer } from "@/data/learning";
import { clearRound, loadRound, saveRound } from "@/data/round-store";
import { TASK_LABELS } from "@/domain/labels";
import { passageParts, type PracticeItem, type Step } from "@/domain/practice";
import { advance, choose, currentStep, finished, newRound, result, usedBankOptions, type Round } from "@/domain/round";
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
  const pick = useCallback((option: number | null) => {
    setRound((current) => {
      if (!current || current.revealed || finished(current)) return current;
      const item = current.items[current.index];
      const step = item.steps[current.step];
      recordAnswer({ senseId: step.senseId, wordId: step.wordId, task: item.kind as PracticeTask, correct: option === step.answer, day: calendarDay(new Date()) });
      return choose(current, option);
    });
  }, []);
  const next = useCallback(() => setRound((current) => (current ? advance(current) : current)), []);
  if (!round) return null;
  if (finished(round)) return <Results onAgain={(items) => { const again = newRound(items, round.setIds); saveRound(again); setRound(again); }} round={round} />;
  return <Card next={next} pick={pick} round={round} />;
}

function Card({ round, pick, next }: { round: Round; pick: (option: number | null) => void; next: () => void }) {
  const item = round.items[round.index];
  const step = currentStep(round)!;
  const chosen = round.choices[round.index][round.step];
  const used = usedBankOptions(round);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || (event.target as HTMLElement).closest("input,textarea")) return;
      if (round.revealed && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); next(); return; }
      const number = Number(event.key);
      if (!round.revealed && number >= 1 && number <= step.options.length && !used.has(number - 1)) pick(number - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [round.revealed, step, used, pick, next]);
  const progress = (round.index + (round.revealed ? 1 : 0)) / round.items.length;
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-2xl flex-col px-[var(--gutter)] pb-[max(1.5rem,var(--safe-bottom))] pt-[calc(var(--safe-top)+0.5rem)] md:pt-4">
      <header className="flex items-center gap-3">
        <HeaderButton aria-label="離開練習（進度會保留）" asChild><AppLink href="/app/practice"><X weight="bold" /></AppLink></HeaderButton>
        <ProgressBar className="flex-1" label="練習進度" value={progress} />
        <span className="font-latin text-sm tabular-nums text-ink-muted">{round.index + 1}/{round.items.length}</span>
      </header>
      <div className="card-in flex flex-1 flex-col gap-5 pt-6" key={round.index}>
        <Chip className="self-start">{TASK_LABELS[item.kind as PracticeTask]}{item.steps.length > 1 ? ` · 第 ${round.step + 1}/${item.steps.length} 格` : ""}</Chip>
        <Prompt chosen={chosen} item={item} round={round} step={step} />
        <div className="message-in" key={round.step}><Options chosen={chosen} pick={pick} revealed={round.revealed} step={step} used={used} /></div>
        {round.revealed ? <Feedback chosen={chosen} item={item} step={step} /> : null}
        <div className="mt-auto flex justify-end gap-2 pt-2">
          {round.revealed ? (
            <Button autoFocus onClick={next} size="lg" variant="primary">{round.index + 1 === round.items.length && round.step + 1 === item.steps.length ? "看結果" : "下一題"}<ArrowRight weight="bold" /></Button>
          ) : (
            <Button onClick={() => pick(null)} size="lg" variant="ghost">不會，看答案</Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Prompt({ item, step, round, chosen }: { item: PracticeItem; step: Step; round: Round; chosen: number | null | undefined }) {
  if (item.kind === "meaning")
    return (
      <div className="grid gap-1 py-6 text-center">
        <p className="flex items-center justify-center gap-2 font-latin text-4xl font-bold tracking-tight md:text-5xl" lang="en">{item.word}<SpeakButton text={item.word} /></p>
        <p className="text-sm text-ink-muted">選出它在這裡的意思</p>
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
      <p className="py-4 font-latin text-xl leading-relaxed md:text-2xl" lang="en">
        {before}
        <span className={cn("mx-1 inline-block min-w-20 rounded-chip border-b-2 px-2 text-center", filled ? "border-positive bg-positive/10 text-positive" : "border-contrast bg-accent-soft")}>{filled ?? " "}</span>
        {after}
      </p>
    );
  }
  // A passage: blanks before this one show what was picked, this one is highlighted.
  if (!("passage" in item)) return null;
  const answers = round.choices[round.index];
  return (
    <div className="grid gap-3">
      <Panel className="max-h-[45svh] overflow-y-auto">
        {item.title ? <h2 className="mb-2 font-latin text-lg font-semibold" lang="en">{item.title}</h2> : null}
        <p className="whitespace-pre-line font-latin text-[1.0625rem] leading-[1.8]" lang="en">
          {passageParts(item.passage).map((part, index) => {
            if (typeof part === "string") return <span key={index}>{part}</span>;
            const at = item.steps.findIndex((entry) => entry.blank === part);
            const done = at < round.step || (at === round.step && round.revealed);
            const picked = done ? answers[at] : undefined;
            const right = done && picked === item.steps[at].answer;
            return (
              <span
                className={cn(
                  "mx-0.5 inline-flex min-w-12 items-baseline justify-center rounded-chip px-1.5 text-[0.9375rem] font-semibold",
                  at === round.step && !round.revealed ? "bg-contrast text-on-contrast" : done ? (right ? "bg-positive/12 text-positive" : "bg-danger/12 text-danger") : "bg-surface-raised text-ink-muted",
                )}
                key={index}
              >
                {done ? (right ? item.steps[at].options[item.steps[at].answer] : `(${part}) ${item.steps[at].options[item.steps[at].answer]}`) : `(${part})`}
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

function Options({ step, chosen, revealed, used, pick }: { step: Step; chosen: number | null | undefined; revealed: boolean; used: Set<number>; pick: (option: number) => void }) {
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
            <span className={cn("min-w-0 flex-1", /[A-Za-z]/.test(option) && "font-latin")} lang={/[A-Za-z]/.test(option) ? "en" : undefined}>{option}</span>
          </button>
        );
      })}
    </div>
  );
}

function Feedback({ item, step, chosen }: { item: PracticeItem; step: Step; chosen: number | null | undefined }) {
  const right = chosen === step.answer;
  const reason = chosen !== null && chosen !== undefined && !right ? step.whyWrong?.[step.options[chosen]] : undefined;
  const notes = item.kind === "meaning" || item.kind === "reverse" ? descriptionPoints(item.sense.description) : [];
  return (
    <Panel className="message-in grid gap-2" role="status">
      <p className={cn("flex items-center gap-2 font-semibold", right ? "text-positive" : "text-danger")}>
        {right ? <Check weight="bold" /> : <X weight="bold" />}
        {right ? "答對了" : <>正確答案是 <span className="font-latin">{step.options[step.answer]}</span></>}
      </p>
      {item.kind === "meaning" || item.kind === "reverse" ? (
        <p className="text-[0.9375rem]"><span className="font-latin font-semibold">{item.word}</span> <span className="font-latin text-ink-muted">{item.sense.pos}</span> {item.sense.meaning}</p>
      ) : null}
      {reason ? <p className="text-[0.9375rem] text-ink-muted">{reason}</p> : null}
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
                  : <span className="text-ink-muted">{TASK_LABELS[item.kind as PracticeTask]}：{item.steps.map((step) => step.options[step.answer]).join("、")}</span>}
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

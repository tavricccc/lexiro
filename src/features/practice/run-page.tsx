import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useNavigate } from "react-router";
import { ArrowRight, ArrowCounterClockwise, Check, X } from "@phosphor-icons/react";
import { calendarDay, descriptionPoints, type PracticeTask } from "@lexiro/contract";
import { Resizable, ResizableHandle, ResizablePanel } from "@ui-sdk/react/resizable";
import { AnimatedNumber, AppLink, Button, Chip, HeaderButton, ProgressBar, cn } from "design-kit";
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

function hasPassage(item: PracticeItem): boolean {
  if (item.kind === "custom") return Boolean(item.passage);
  return "passage" in item;
}

const WIDE_EXAM_QUERY = "(min-width: 1024px)";
function useWideExam() {
  return useSyncExternalStore(
    (cb) => {
      if (typeof window === "undefined" || !window.matchMedia) return () => {};
      const mql = window.matchMedia(WIDE_EXAM_QUERY);
      mql.addEventListener("change", cb);
      return () => mql.removeEventListener("change", cb);
    },
    () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(WIDE_EXAM_QUERY).matches : false),
    () => false,
  );
}

function Card({ round, pick, next, accept }: { round: Round; pick: (option: Choice | null) => void; next: () => void; accept: () => void }) {
  const item = round.items[round.index];
  const step = currentStep(round)!;
  const chosen = round.choices[round.index][round.step];
  const used = usedBankOptions(round);
  const split = hasPassage(item);
  const wide = useWideExam();

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
  const taskTag = `${item.kind === "custom" ? item.label : TASK_LABELS[item.kind as PracticeTask]}${item.steps.length > 1 ? ` · ${round.step + 1}/${item.steps.length}` : ""}`;
  const isLast = round.index + 1 === round.items.length && round.step + 1 === item.steps.length;

  const answerArea = (
    <div className="grid gap-5">
      <div className="message-in" key={round.step}>
        {isCustomStep(step) && step.mode !== "single"
          ? <CustomAnswer chosen={chosen} revealed={round.revealed} step={step} submit={pick} />
          : <Options chosen={chosen as number | null | undefined} pick={pick} revealed={round.revealed} step={step as Step} used={used} />}
      </div>
      {round.revealed ? <Feedback accept={accept} chosen={chosen} item={item} step={step} /> : null}
    </div>
  );

  return (
    <div className="fixed inset-0 flex flex-col bg-canvas overscroll-none">
      {/* Top Swiss Instrument Bar */}
      <header className="flex shrink-0 items-center gap-3 border-b-2 border-line-strong bg-surface px-[var(--gutter)] pb-3 pt-[calc(var(--safe-top)+0.75rem)] md:px-8 md:py-3">
        <HeaderButton aria-label="離開練習（進度會保留）" asChild>
          <AppLink href="/app/practice"><X weight="bold" /></AppLink>
        </HeaderButton>
        <Chip tone="info">{taskTag}</Chip>
        <ProgressBar className="flex-1" label="練習進度" value={progress} />
        <span className="font-mono text-sm font-bold tabular-nums text-ink">
          {String(round.index + 1).padStart(2, "0")}/{String(round.items.length).padStart(2, "0")}
        </span>
      </header>

      {/* Adaptive Exam Surface: draggable Resizable 50/50 split on desktop for passages */}
      {split && wide ? (
        <Resizable autoSaveId="lexiro:exam-split" className="card-in flex min-h-0 flex-1" key={round.index}>
          <ResizablePanel className="min-h-0 overflow-y-auto overscroll-contain bg-surface p-8 xl:p-12" defaultSize={50} id="passage" minSize={28}>
            <PassagePane item={item} round={round} />
          </ResizablePanel>
          <ResizableHandle
            aria-label="調整篇章與題目寬度"
            className="group relative flex w-2 shrink-0 cursor-col-resize items-center justify-center bg-line-strong/20 outline-none transition-colors hover:bg-contrast data-dragging:bg-contrast focus-visible:bg-contrast"
          >
            <span aria-hidden className="h-10 w-0.5 bg-surface" />
          </ResizableHandle>
          <ResizablePanel className="min-h-0 overflow-y-auto overscroll-contain p-8 xl:p-12" defaultSize={50} id="question" minSize={28}>
            <div className="mx-auto grid max-w-xl gap-6">
              <PassageQuestionStem chosen={chosen as number | null | undefined} item={item} step={step} />
              {answerArea}
            </div>
          </ResizablePanel>
        </Resizable>
      ) : split ? (
        <div className="card-in grid min-h-0 flex-1 overflow-y-auto overscroll-contain" key={round.index}>
          <section className="border-b-2 border-line-strong bg-surface p-5 md:p-8">
            <PassagePane item={item} round={round} />
          </section>
          <section className="p-5 md:p-8">
            <div className="mx-auto grid max-w-xl gap-6">
              <PassageQuestionStem chosen={chosen as number | null | undefined} item={item} step={step} />
              {answerArea}
            </div>
          </section>
        </div>
      ) : (
        <div className="card-in min-h-0 flex-1 overflow-y-auto overscroll-contain px-[var(--gutter)] py-6 md:px-10 md:py-12" key={round.index}>
          <div className="mx-auto grid max-w-3xl gap-8">
            <div className="border-b-2 border-line-strong pb-6">
              {item.kind === "custom"
                ? <CustomStem item={item} step={step as CustomStep} />
                : <StandalonePrompt item={item} round={round} step={step as Step} />}
            </div>
            {answerArea}
          </div>
        </div>
      )}

      {/* Bottom Action Bar */}
      <footer className="flex shrink-0 items-center justify-between gap-4 border-t-2 border-line-strong bg-surface px-[var(--gutter)] pb-[max(0.875rem,var(--safe-bottom))] pt-3.5 md:px-8">
        <span className="hidden font-mono text-xs uppercase tracking-[0.08em] text-ink-faint md:inline">
          {round.revealed ? "ENTER / SPACE — CONTINUE" : "KEYS 1–4 — SELECT OPTION"}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {round.revealed ? (
            <Button autoFocus onClick={next} size="lg" variant="primary">
              {isLast ? "看結果" : "下一題"}
              <ArrowRight weight="bold" />
            </Button>
          ) : (
            <Button onClick={() => pick(null)} size="lg" variant="ghost">不會，看答案</Button>
          )}
        </div>
      </footer>
    </div>
  );
}

function PassagePane({ item, round }: { item: PracticeItem; round: Round }) {
  if (item.kind === "custom") {
    return (
      <div className="mx-auto grid max-w-prose gap-4">
        <span className="font-mono text-xs font-semibold uppercase tracking-[0.1em] text-contrast">PASSAGE // 閱讀文本</span>
        {item.instructions ? <p className="border-l-2 border-line-strong pl-3 text-sm text-ink-muted">{item.instructions}</p> : null}
        {item.passage ? <p className="whitespace-pre-line font-latin text-[1.0625rem] leading-[1.9] text-ink" lang="en">{item.passage}</p> : null}
      </div>
    );
  }
  if (!("passage" in item)) return null;
  const steps = item.steps;
  const answers = round.choices[round.index];
  return (
    <div className="mx-auto grid max-w-prose gap-4">
      <span className="font-mono text-xs font-semibold uppercase tracking-[0.1em] text-contrast">PASSAGE // 篇章閱讀</span>
      {item.title ? <h2 className="font-latin text-2xl font-extrabold tracking-[-0.025em]" lang="en">{item.title}</h2> : null}
      <p className="whitespace-pre-line font-latin text-[1.0625rem] leading-[1.9] text-ink" lang="en">
        {passageParts(item.passage).map((part, index) => {
          if (typeof part === "string") return <span key={index}>{part}</span>;
          const at = steps.findIndex((entry) => entry.blank === part);
          const done = at < round.step || (at === round.step && round.revealed);
          const picked = done ? answers[at] : undefined;
          const right = done && picked === steps[at].answer;
          return (
            <span
              className={cn(
                "mx-1 inline-flex min-w-12 items-baseline justify-center border px-1.5 font-mono text-[0.9375rem] font-bold",
                at === round.step && !round.revealed
                  ? "border-contrast bg-contrast text-on-contrast"
                  : done
                    ? (right ? "border-positive bg-positive/12 text-positive" : "border-danger bg-danger/12 text-danger")
                    : "border-line-strong/30 bg-surface-raised text-ink-muted",
              )}
              key={index}
            >
              {done ? (right ? steps[at].options[steps[at].answer] : `(${part}) ${steps[at].options[steps[at].answer]}`) : `(${part})`}
            </span>
          );
        })}
      </p>
    </div>
  );
}

function PassageQuestionStem({ item, step, chosen }: { item: PracticeItem; step: Step | CustomStep; chosen: number | null | undefined }) {
  if (item.kind === "custom") {
    const customStep = step as CustomStep;
    return (
      <p className={cn("leading-relaxed", /[A-Za-z]/.test(customStep.prompt) ? "font-latin text-xl font-bold md:text-2xl" : "text-xl font-bold")} lang={/[A-Za-z]/.test(customStep.prompt) ? "en" : undefined}>
        {customStep.prompt}
      </p>
    );
  }
  const regularStep = step as Step;
  if (item.kind === "reading")
    return <p className="font-latin text-xl font-bold leading-snug tracking-[-0.015em] md:text-2xl" lang="en">{regularStep.prompt}</p>;
  if (chosen === undefined)
    return <p className="font-mono text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">選出第 {regularStep.blank} 格的答案</p>;
  return null;
}

function StandalonePrompt({ item, step, round }: { item: PracticeItem; step: Step; round: Round }) {
  if (item.kind === "meaning")
    return (
      <div className="grid gap-3">
        <span className="font-mono text-xs font-semibold uppercase tracking-[0.1em] text-ink-faint">TERM // 選出正確意思</span>
        <div className="flex flex-wrap items-center gap-3">
          <p className="font-latin text-[clamp(2.5rem,7vw,4.75rem)] font-black leading-[1.02] tracking-[-0.045em] text-ink" lang="en">{item.word}</p>
          <SpeakButton size="icon" text={item.word} />
        </div>
      </div>
    );
  if (item.kind === "reverse")
    return (
      <div className="grid gap-3">
        <span className="font-mono text-xs font-semibold uppercase tracking-[0.1em] text-ink-faint">
          <span className="text-contrast">{item.sense.pos}</span> // 選出對應英文單字
        </span>
        <p className="text-[clamp(2rem,5.5vw,3.5rem)] font-black leading-[1.1] tracking-[-0.03em] text-ink">{item.sense.meaning}</p>
      </div>
    );
  if (item.kind === "vocabulary") {
    const [before, after] = step.prompt.split("_____");
    const filled = round.revealed ? step.options[step.answer] : null;
    return (
      <div className="grid gap-3">
        <span className="font-mono text-xs font-semibold uppercase tracking-[0.1em] text-ink-faint">CONTEXT // 語境填空</span>
        <p className="font-latin text-2xl font-medium leading-[1.55] tracking-[-0.015em] md:text-3xl" lang="en">
          {before}
          <span className={cn(
            "mx-1.5 inline-block min-w-28 border-b-4 px-2 text-center font-bold",
            filled ? "border-positive bg-positive/12 text-positive" : "border-contrast bg-accent-soft text-contrast",
          )}>
            {filled ?? "\u00A0"}
          </span>
          {after}
        </p>
      </div>
    );
  }
  return null;
}

function CustomStem({ item, step }: { item: Extract<PracticeItem, { kind: "custom" }>; step: CustomStep }) {
  return (
    <div className="grid gap-3">
      {item.instructions ? <p className="font-mono text-xs font-semibold text-ink-muted">{item.instructions}</p> : null}
      <p className={cn("leading-snug tracking-[-0.02em]", /[A-Za-z]/.test(step.prompt) ? "font-latin text-2xl font-bold md:text-3xl" : "text-2xl font-extrabold md:text-3xl")} lang={/[A-Za-z]/.test(step.prompt) ? "en" : undefined}>
        {step.prompt}
      </p>
    </div>
  );
}

function Options({ step, chosen, revealed, used, pick }: { step: Pick<Step, "options" | "answer" | "glosses">; chosen: number | null | undefined; revealed: boolean; used: Set<number>; pick: (option: number) => void }) {
  const long = step.options.some((option) => option.length > 24);
  return (
    <div className={cn("grid gap-2.5", !long && step.options.length <= 4 && "sm:grid-cols-2")} role="group" aria-label="選項">
      {step.options.map((option, index) => {
        const right = revealed && index === step.answer;
        const wrong = revealed && index === chosen && chosen !== step.answer;
        return (
          <button
            className={cn(
              "group flex min-h-16 items-stretch border text-left text-base outline-none transition-[background-color,border-color,color] duration-[var(--motion-control)] ease-[var(--ease-move)] focus-visible:ring-2 focus-visible:ring-contrast disabled:cursor-default",
              !revealed && "border-line-strong/30 bg-surface hover:border-line-strong hover:bg-surface-raised",
              right && "border-positive bg-positive/10",
              wrong && "border-danger bg-danger/10",
              revealed && !right && !wrong && "border-line bg-surface opacity-45",
              used.has(index) && !revealed && "opacity-30",
            )}
            disabled={revealed || used.has(index)}
            key={index}
            onClick={() => pick(index)}
            type="button"
          >
            <span
              aria-hidden
              className={cn(
                "grid w-11 shrink-0 place-items-center border-r font-mono text-xs font-bold tabular-nums transition-colors",
                right ? "border-positive bg-positive text-white"
                  : wrong ? "border-danger bg-danger text-white"
                    : "border-line bg-surface-raised text-ink-muted group-hover:border-line-strong group-hover:bg-contrast group-hover:text-on-contrast",
              )}
            >
              {right ? <Check weight="bold" /> : wrong ? <X weight="bold" /> : index + 1}
            </span>
            <span className="flex min-w-0 flex-1 flex-col justify-center px-4 py-3">
              <span className={cn("block font-semibold", /[A-Za-z]/.test(option) && "font-latin")} lang={/[A-Za-z]/.test(option) ? "en" : undefined}>{option}</span>
              {revealed && step.glosses?.[index] ? (
                <span className={cn("message-in mt-0.5 block text-[0.8125rem] text-ink-muted", /[A-Za-z]/.test(step.glosses[index]!) && "font-latin")} lang={/[A-Za-z]/.test(step.glosses[index]!) ? "en" : undefined}>
                  {step.glosses[index]}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

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
    <div
      className={cn(
        "message-in grid gap-2.5 border border-l-4 bg-surface p-5",
        right ? "border-line border-l-positive" : "border-line border-l-danger",
      )}
      role="status"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={cn("flex items-center gap-2 font-bold", right ? "text-positive" : "text-danger")}>
          {right ? <Check weight="bold" /> : <X weight="bold" />}
          {right ? "答對了" : <>正確答案是 <span className={cn(/[A-Za-z]/.test(answer) && "font-latin")}>{answer}</span></>}
        </p>
        {typedWrong ? <Button onClick={accept} size="sm" variant="secondary">我其實答對了</Button> : null}
      </div>
      {typedWrong && isCustomStep(step) && step.mode === "input" && step.accepted.length > 1 ? <p className="font-mono text-xs text-ink-muted">{step.accepted.join(" / ")}</p> : null}
      {item.kind === "meaning" || item.kind === "reverse" ? (
        <p className="text-[0.9375rem]"><span className="font-latin font-bold">{item.word}</span> <span className="font-mono text-xs text-ink-muted">{item.sense.pos}</span> {item.sense.meaning}</p>
      ) : null}
      {reasons.map((reason) => <p className="text-[0.9375rem] text-ink-muted" key={reason}>{reason}</p>)}
      {step.explanation && item.kind !== "meaning" && item.kind !== "reverse" ? <p className="text-[0.9375rem] leading-relaxed text-ink-muted">{step.explanation}</p> : null}
      {notes.length ? <ul className="grid gap-1 border-l-2 border-line pl-3 text-[0.9375rem] text-ink-muted">{notes.map((note, index) => <li key={index}>{note}</li>)}</ul> : null}
      {item.kind === "meaning" || item.kind === "reverse" ? item.sense.examples.slice(0, 1).map((example) => (
        <p className="font-latin text-[0.9375rem] italic text-ink-muted" key={example} lang="en">{example}</p>
      )) : null}
    </div>
  );
}

function Results({ round, onAgain }: { round: Round; onAgain: (items: PracticeItem[]) => void }) {
  const outcome = useMemo(() => result(round), [round]);
  useEffect(() => clearRound(), []);
  const score = outcome.total ? Math.round((outcome.correct / outcome.total) * 100) : 0;
  return (
    <div className="swiss-grid-bg grid min-h-svh place-items-center px-[var(--gutter)] py-10">
      <div className="content-in grid w-full max-w-2xl border-2 border-line-strong bg-surface shadow-float">
        <div className="grid gap-4 border-b-2 border-line-strong p-8 md:p-10">
          <span className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">SESSION REPORT // 回合結算</span>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <p className="font-latin text-[clamp(4.5rem,14vw,8rem)] font-black leading-[0.84] tracking-[-0.06em] text-contrast">
              <AnimatedNumber value={score} />%
            </p>
            <div className="text-right font-mono">
              <span className="block text-xs uppercase text-ink-faint">ACCURACY</span>
              <span className="text-2xl font-bold tabular-nums text-ink">{outcome.correct} / {outcome.total}</span>
            </div>
          </div>
        </div>

        <div className="grid gap-5 p-8 md:p-10">
          {outcome.missed.length ? (
            <div className="grid gap-3">
              <h2 className="font-mono text-xs font-semibold uppercase tracking-[0.1em] text-danger">MISSED ITEMS // 要再看看 ({outcome.missed.length})</h2>
              <ul className="divide-y divide-line border border-line">
                {outcome.missed.slice(0, 8).map((item, index) => (
                  <li className="flex items-baseline gap-3 px-4 py-2.5 text-[0.9375rem]" key={index}>
                    <span className="font-mono text-xs text-ink-faint">{String(index + 1).padStart(2, "0")}</span>
                    {item.kind === "meaning" || item.kind === "reverse"
                      ? <span><span className="font-latin font-bold">{item.word}</span> <span className="text-ink-muted">{item.sense.meaning}</span></span>
                      : <span className="text-ink-muted">{item.kind === "custom" ? item.label : TASK_LABELS[item.kind as PracticeTask]}：{(item.steps as (Step | CustomStep)[]).map(rightAnswerText).join("、")}</span>}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="border-l-4 border-positive pl-4 text-xl font-extrabold text-positive">全對，表現完美。</p>
          )}

          <div className="grid gap-3 pt-2 sm:grid-cols-2">
            {outcome.missed.length ? (
              <Button onClick={() => onAgain(outcome.missed)} size="lg" variant="primary">
                <ArrowCounterClockwise weight="bold" />再練錯的 {outcome.missed.length} 題
              </Button>
            ) : null}
            <Button asChild size="lg" variant={outcome.missed.length ? "secondary" : "primary"}>
              <AppLink href="/app">完成</AppLink>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

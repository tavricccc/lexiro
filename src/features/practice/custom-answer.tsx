import { useState } from "react";
import { Check, X } from "@phosphor-icons/react";
import { Button, Input, cn } from "design-kit";
import { isRight, type Choice, type CustomStep } from "@/domain/custom";

type Mode<M extends CustomStep["mode"]> = Extract<CustomStep, { mode: M }>;
interface Props<M extends CustomStep["mode"]> {
  step: Mode<M>;
  chosen: Choice | null | undefined;
  revealed: boolean;
  submit: (choice: Choice) => void;
}

const latin = (text: string) => /[A-Za-z]/.test(text);
const tile = "rounded-tile border px-4 py-3 text-left text-base outline-none transition-[background-color,border-color,transform] duration-[var(--motion-control)] ease-[var(--ease-move)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:cursor-default";
const chip = "rounded-chip border px-3 py-2 font-latin text-base outline-none transition-[background-color,border-color,transform] duration-[var(--motion-control)] ease-[var(--ease-move)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:cursor-default";

function Confirm({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return <Button className="justify-self-end" disabled={disabled} onClick={onClick} size="lg" variant="primary"><Check weight="bold" />確認</Button>;
}

function Multiple({ step, chosen, revealed, submit }: Props<"multiple">) {
  const [picked, setPicked] = useState<number[]>([]);
  const shown = revealed && Array.isArray(chosen) ? chosen : picked;
  const toggle = (index: number) => setPicked((current) => (current.includes(index) ? current.filter((value) => value !== index) : [...current, index]));
  return (
    <div className="grid gap-3">
      <div className="grid gap-2" role="group" aria-label="選項，可複選">
        {step.options.map((option, index) => {
          const on = shown.includes(index);
          const right = revealed && step.answers.includes(index);
          const wrong = revealed && on && !right;
          return (
            <button
              aria-pressed={on}
              className={cn(
                tile, "flex min-h-14 items-center gap-3",
                !revealed && (on ? "border-contrast bg-accent-soft" : "border-line bg-surface hover:bg-surface-raised active:scale-[var(--motion-press-scale)]"),
                right && "border-positive bg-positive/12",
                wrong && "border-danger bg-danger/12",
                revealed && !right && !wrong && "border-line bg-surface opacity-60",
              )}
              disabled={revealed}
              key={index}
              onClick={() => toggle(index)}
              type="button"
            >
              <span aria-hidden className={cn("grid size-7 shrink-0 place-items-center rounded-chip text-sm font-semibold", right ? "text-base text-positive-ink" : wrong ? "text-base text-danger-ink" : on ? "bg-contrast text-on-contrast" : "bg-surface-raised text-ink-muted")}>
                {right ? <Check weight="bold" /> : wrong ? <X weight="bold" /> : on ? <Check weight="bold" /> : index + 1}
              </span>
              <span className={cn("min-w-0 flex-1", latin(option) && "font-latin")} lang={latin(option) ? "en" : undefined}>{option}</span>
            </button>
          );
        })}
      </div>
      {revealed ? null : <Confirm disabled={!picked.length} onClick={() => submit([...picked].sort((a, b) => a - b))} />}
    </div>
  );
}

function Typed({ step, chosen, revealed, submit }: Props<"input">) {
  const [text, setText] = useState("");
  const value = revealed ? (typeof chosen === "string" ? chosen : "") : text;
  const right = revealed && isRight(step, chosen);
  return (
    <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); if (text.trim()) submit(text); }}>
      <Input
        aria-label="你的答案"
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        autoFocus
        className={cn("h-14 font-latin text-lg", revealed && (right ? "border-positive bg-positive/12" : "border-danger bg-danger/12"))}
        disabled={revealed}
        lang="en"
        onChange={(event) => setText(event.target.value)}
        spellCheck={false}
        value={value}
      />
      {revealed ? null : <Button className="justify-self-end" disabled={!text.trim()} size="lg" type="submit" variant="primary"><Check weight="bold" />確認</Button>}
    </form>
  );
}

function Order({ step, chosen, revealed, submit }: Props<"order">) {
  const [placed, setPlaced] = useState<number[]>([]);
  const line = revealed && Array.isArray(chosen) ? chosen : placed;
  const left = step.pieces.map((_, index) => index).filter((index) => !line.includes(index));
  return (
    <div className="grid gap-3">
      <div aria-label="你排的順序" className="flex min-h-16 flex-wrap content-start gap-2 rounded-tile border border-dashed border-line p-2" role="list">
        {line.map((index, at) => {
          const right = revealed && step.order[at] === index;
          return (
            <button
              className={cn(chip, revealed ? (right ? "border-positive bg-positive/12 text-positive-ink" : "border-danger bg-danger/12 text-danger-ink") : "border-contrast bg-accent-soft active:scale-[var(--motion-press-scale)]")}
              disabled={revealed}
              key={index}
              lang="en"
              onClick={() => setPlaced((current) => current.filter((value) => value !== index))}
              role="listitem"
              type="button"
            >
              {step.pieces[index]}
            </button>
          );
        })}
      </div>
      {revealed ? null : (
        <>
          <div aria-label="還沒排的片段" className="flex flex-wrap gap-2" role="group">
            {left.map((index) => (
              <button className={cn(chip, "border-line bg-surface hover:bg-surface-raised active:scale-[var(--motion-press-scale)]")} key={index} lang="en" onClick={() => setPlaced((current) => [...current, index])} type="button">
                {step.pieces[index]}
              </button>
            ))}
          </div>
          <Confirm disabled={left.length > 0} onClick={() => submit(placed)} />
        </>
      )}
    </div>
  );
}

function Match({ step, chosen, revealed, submit }: Props<"match">) {
  const [pairs, setPairs] = useState<number[]>(() => step.left.map(() => -1));
  const [active, setActive] = useState(0);
  const shown = revealed && Array.isArray(chosen) ? chosen : pairs;
  const pick = (right: number) => {
    const next = pairs.map((value, index) => (index === active ? right : value === right ? -1 : value));
    setPairs(next);
    const open = next.findIndex((value) => value === -1);
    if (open !== -1) setActive(open);
  };
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="grid content-start gap-2" role="group" aria-label="左欄">
          {step.left.map((text, index) => {
            const right = revealed && shown[index] === step.match[index];
            return (
              <button
                aria-pressed={!revealed && active === index}
                className={cn(
                  tile, "flex min-h-14 items-center gap-2",
                  revealed ? (right ? "border-positive bg-positive/12" : "border-danger bg-danger/12") : active === index ? "border-contrast bg-accent-soft" : "border-line bg-surface hover:bg-surface-raised",
                )}
                disabled={revealed}
                key={index}
                onClick={() => setActive(index)}
                type="button"
              >
                <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-full bg-surface-raised font-latin text-xs font-semibold text-ink-muted">{index + 1}</span>
                <span className={cn("min-w-0 flex-1", latin(text) && "font-latin")} lang={latin(text) ? "en" : undefined}>{text}</span>
              </button>
            );
          })}
        </div>
        <div className="grid content-start gap-2" role="group" aria-label="右欄">
          {step.right.map((text, index) => {
            const owner = shown.indexOf(index);
            return (
              <button
                className={cn(tile, "flex min-h-14 items-center gap-2", owner === -1 ? "border-line bg-surface hover:bg-surface-raised" : "border-contrast/40 bg-surface-raised", revealed && "opacity-80")}
                disabled={revealed}
                key={index}
                onClick={() => pick(index)}
                type="button"
              >
                <span className={cn("min-w-0 flex-1", latin(text) && "font-latin")} lang={latin(text) ? "en" : undefined}>{text}</span>
                {owner === -1 ? null : <span aria-label={`配給第 ${owner + 1} 項`} className="grid size-6 shrink-0 place-items-center rounded-full bg-contrast font-latin text-xs font-semibold text-on-contrast">{owner + 1}</span>}
              </button>
            );
          })}
        </div>
      </div>
      {revealed ? null : <Confirm disabled={pairs.includes(-1)} onClick={() => submit(pairs)} />}
    </div>
  );
}

/** The answer area of a 自由題型 step that is not a plain single choice. */
export function CustomAnswer(props: { step: Exclude<CustomStep, { mode: "single" }>; chosen: Choice | null | undefined; revealed: boolean; submit: (choice: Choice) => void }) {
  const { step, ...rest } = props;
  switch (step.mode) {
    case "multiple": return <Multiple step={step} {...rest} />;
    case "input": return <Typed step={step} {...rest} />;
    case "order": return <Order step={step} {...rest} />;
    case "match": return <Match step={step} {...rest} />;
  }
}

"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Icons } from "@/components/ui/icons";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";

/**
 * The grouped list.
 *
 * This is the shape a phone uses for settings, for choices, and for anything
 * that reads as "a label, and what it is set to". It replaced the label-above-
 * a-box form that these screens used to be: a form asks you to fill something
 * in, a list tells you what things are and lets you change one. On a phone the
 * label and its value belong on the same line — stacking them is what made the
 * product read as a web page someone had shrunk.
 *
 * Every row is at least 44px tall because that is the smallest thing a thumb
 * can reliably hit, and the whole row is the target when the row does
 * something, never just the chevron or the word.
 */
export function ListSection({
  children,
  className,
  footer,
  header,
  headerAction,
}: {
  children: ReactNode;
  className?: string;
  /** The sentence under the group, explaining what changing it does. */
  footer?: ReactNode;
  header?: string;
  /** One trailing control on the header line, such as 編輯. */
  headerAction?: ReactNode;
}) {
  return (
    <section className={className}>
      {(header || headerAction) && (
        <div className="mb-2 flex min-h-6 items-center justify-between gap-3 px-1">
          {header && <h2 className="type-list-header">{header}</h2>}
          {headerAction}
        </div>
      )}
      <div className="rule-card rule-list">{children}</div>
      {footer && <p className="type-list-footer mt-2 px-1">{footer}</p>}
    </section>
  );
}

interface RowContent {
  /** The leading glyph, for rows that are a destination rather than a setting. */
  icon?: LucideIcon;
  label: ReactNode;
  /** The second line: what this row is for, in the reader's words. */
  detail?: ReactNode;
  /** What it is set to, or what it costs — the thing the reader came to read. */
  value?: ReactNode;
  tone?: "default" | "destructive" | "brand";
}

const toneClass = {
  default: "",
  destructive: "text-destructive",
  brand: "text-primary",
} as const;

function RowInner({
  icon: Icon,
  label,
  detail,
  value,
  tone = "default",
  trailing,
}: RowContent & { trailing?: ReactNode }) {
  return (
    <>
      {Icon && (
        <Icon
          aria-hidden
          className="mt-px size-[1.125rem] shrink-0 text-muted-foreground"
        />
      )}
      <span className="min-w-0 flex-1">
        <span className={cn("type-row block", toneClass[tone])}>{label}</span>
        {detail && <span className="type-row-detail mt-0.5 block">{detail}</span>}
      </span>
      {value !== undefined && value !== null && value !== "" && (
        <span className="type-row-value shrink-0 text-right">{value}</span>
      )}
      {trailing}
    </>
  );
}

const rowClass =
  "t-row flex w-full min-h-11 items-center gap-3 py-2.5 text-left";

/** A row that only reports: a label, and what it is set to. */
export function ListRow({ className, ...content }: RowContent & { className?: string }) {
  return (
    <div className={cn(rowClass, className)}>
      <RowInner {...content} />
    </div>
  );
}

/**
 * A row that leads somewhere: another screen, a dialog, a file picker.
 *
 * It carries a chevron because that is the only honest way to say a tap here
 * goes somewhere, and the chevron never becomes the target on its own.
 */
export function ListNavRow({
  disabled,
  expanded,
  href,
  onClick,
  ...content
}: RowContent & {
  disabled?: boolean;
  /** Set when the row opens its options in place rather than leading away. */
  expanded?: boolean;
  href?: string;
  onClick?: () => void;
}) {
  const inner = (
    <RowInner
      {...content}
      trailing={
        <Icons.open
          aria-hidden
          className={cn(
            "size-4 shrink-0 text-muted-foreground/70 transition-transform duration-[var(--motion-control)] ease-[var(--ease-move)]",
            expanded && "rotate-90",
          )}
        />
      }
    />
  );
  const shared = cn(rowClass, disabled && "pointer-events-none opacity-45");
  if (href)
    return (
      <Link className={shared} href={href}>
        {inner}
      </Link>
    );
  return (
    <button
      aria-expanded={expanded}
      className={shared}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {inner}
    </button>
  );
}

/**
 * One option among several, marked by a check.
 *
 * This is the answer to "how do I choose between two things": a list, not two
 * buttons side by side. Two buttons on one line mean 取消 and 確認 — a decision
 * and its way out — so using that shape for a choice tells the reader the wrong
 * thing about what they are looking at. A row also has somewhere to put what
 * the option costs, which is exactly what the reader needs to choose.
 */
export function ListChoiceRow({
  disabled,
  onSelect,
  selected,
  ...content
}: RowContent & {
  disabled?: boolean;
  onSelect: () => void;
  selected: boolean;
}) {
  return (
    <button
      aria-checked={selected}
      className={cn(rowClass, disabled && "pointer-events-none opacity-45")}
      disabled={disabled}
      onClick={onSelect}
      role="radio"
      type="button"
    >
      <RowInner
        {...content}
        trailing={
          <Icons.success
            aria-hidden
            className={cn(
              "size-[1.125rem] shrink-0 text-primary transition-opacity duration-[var(--motion-control)]",
              !selected && "opacity-0",
            )}
          />
        }
      />
    </button>
  );
}

/** A setting that is on or off. The whole row toggles it. */
export function ListSwitchRow({
  checked,
  disabled,
  onCheckedChange,
  ...content
}: RowContent & {
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className={cn(rowClass, disabled && "opacity-45")}>
      <RowInner
        {...content}
        trailing={
          <Switch
            checked={checked}
            disabled={disabled}
            onCheckedChange={onCheckedChange}
          />
        }
      />
    </label>
  );
}

/**
 * A small whole number, set by pressing rather than by typing.
 *
 * A daily goal moves by one or two at a time, so a keyboard is the wrong tool
 * for it: on a phone, tapping a number field covers half the screen to change
 * 15 into 16.
 */
export function ListStepperRow({
  max,
  min,
  onChange,
  step = 1,
  value,
  ...content
}: Omit<RowContent, "value"> & {
  max: number;
  min: number;
  onChange: (value: number) => void;
  step?: number;
  value: number;
}) {
  const set = (next: number) => onChange(Math.min(max, Math.max(min, next)));
  return (
    <div className={rowClass}>
      <RowInner
        {...content}
        trailing={
          <span className="flex items-center gap-2">
            <span className="type-row-value w-8 text-right tabular-nums">
              {value}
            </span>
            <span className="flex items-center overflow-clip rounded-[var(--radius-control)] bg-[var(--surface-inset)]">
              <StepperButton
                disabled={value <= min}
                label={t("common.decrease")}
                onClick={() => set(value - step)}
                symbol="−"
              />
              <span aria-hidden className="h-5 w-px bg-[var(--rule)]" />
              <StepperButton
                disabled={value >= max}
                label={t("common.increase")}
                onClick={() => set(value + step)}
                symbol="+"
              />
            </span>
          </span>
        }
      />
    </div>
  );
}

function StepperButton({
  disabled,
  label,
  onClick,
  symbol,
}: {
  disabled: boolean;
  label: string;
  onClick: () => void;
  symbol: string;
}) {
  return (
    <button
      aria-label={label}
      className="flex h-9 w-11 items-center justify-center text-base leading-none transition-[background-color,opacity] duration-[var(--motion-control)] active:bg-[var(--surface-active)] disabled:opacity-35"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {symbol}
    </button>
  );
}

/**
 * A row that is an action rather than a setting: 登出, 匯出備份, 刪除.
 *
 * It is centred and tinted because that is how a phone says "this row does
 * something now" as opposed to "this row is a value you can change".
 */
export function ListActionRow({
  children,
  disabled,
  onClick,
  tone = "brand",
  type = "button",
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  tone?: "brand" | "destructive";
  type?: "button" | "submit";
}) {
  return (
    <button
      className={cn(
        "t-row flex min-h-11 w-full items-center justify-center py-2.5 text-center type-row",
        tone === "destructive" ? "text-destructive" : "text-primary",
        disabled && "pointer-events-none opacity-45",
      )}
      disabled={disabled}
      onClick={onClick}
      type={type}
    >
      {children}
    </button>
  );
}

/**
 * A value you type, on the line that names it.
 *
 * The field has no box of its own: the row is the box. A bordered input inside
 * a bordered row draws the same edge twice, and stacking the label above it
 * turns a list back into the web form this replaced.
 */
export function ListInputRow({
  inputMode,
  label,
  max,
  maxLength,
  min,
  onChange,
  placeholder,
  required,
  type = "text",
  value,
}: {
  inputMode?: "numeric" | "email" | "text";
  label: string;
  max?: number;
  maxLength?: number;
  min?: number;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: "text" | "email" | "number";
  value: string;
}) {
  return (
    <label className="flex min-h-11 items-center gap-4 py-2">
      <span className="type-row shrink-0">{label}</span>
      <input
        className="type-row min-w-0 flex-1 border-0 bg-transparent p-0 text-right outline-none placeholder:text-muted-foreground/60"
        inputMode={inputMode}
        max={max}
        maxLength={maxLength}
        min={min}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        type={type}
        value={value}
      />
    </label>
  );
}

/** A row whose content is written by the caller, keeping the list's metrics. */
export function ListCustomRow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("py-3", className)}>{children}</div>;
}

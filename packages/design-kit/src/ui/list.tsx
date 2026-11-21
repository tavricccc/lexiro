import * as React from "react";
import { AppLink } from "./app-link";
import { ArrowRight } from "@phosphor-icons/react/ssr";
import { cn } from "../lib/utils";

/**
 * Swiss structural rows separated by crisp hairlines under a bold top rule.
 */
export function ListGroup({ action, children, className, footer, label, role, title }: {
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  footer?: React.ReactNode;
  label?: string;
  role?: "radiogroup";
  title?: React.ReactNode;
}) {
  const titleId = React.useId();
  return (
    <section aria-label={title ? undefined : label} aria-labelledby={title ? titleId : undefined} className={cn("grid grid-cols-[minmax(0,1fr)] gap-2", className)}>
      {title || action ? (
        <div className="flex min-h-7 items-baseline justify-between gap-3">
          {title ? <h2 className="font-mono text-xs font-semibold uppercase tracking-[0.09em] text-ink-muted" id={titleId}>{title}</h2> : <span />}
          {action}
        </div>
      ) : null}
      <ul className="divide-y divide-line border border-line border-t-2 border-t-line-strong bg-surface" role={role}>{children}</ul>
      {footer ? <p className="text-xs leading-relaxed text-ink-faint">{footer}</p> : null}
    </section>
  );
}

interface ListRowContent {
  detail?: React.ReactNode;
  icon?: React.ReactNode;
  label: React.ReactNode;
  tone?: "default" | "danger";
  value?: React.ReactNode;
}

type ListRowProps = ListRowContent &
  (
    | { href: string; external?: boolean; onClick?: () => void; trailing?: never; disabled?: never }
    | { href?: never; external?: never; onClick: () => void; trailing?: never; disabled?: boolean }
    | { href?: never; external?: never; onClick?: never; trailing?: React.ReactNode; disabled?: never }
  );

export const rowClass =
  "flex min-h-13 w-full items-center gap-3.5 px-4 py-3 text-left outline-none";
const actionClass =
  "group transition-[background-color] duration-[var(--motion-control)] ease-[var(--ease-move)] hover:bg-surface-raised active:bg-surface-pressed focus-visible:bg-surface-raised disabled:pointer-events-none disabled:opacity-40";

function RowBody({ detail, icon, label, tone = "default", value }: ListRowContent) {
  return (
    <>
      {icon ? (
        <span aria-hidden className={cn("shrink-0 [&_svg]:size-5", tone === "danger" ? "text-danger" : "text-ink-muted group-hover:text-contrast")}>
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-[0.9375rem] font-semibold tracking-[-0.01em]", tone === "danger" ? "text-danger" : "text-ink")}>{label}</span>
        {detail ? <span className="mt-0.5 block truncate text-[0.8125rem] text-ink-muted">{detail}</span> : null}
      </span>
      {value !== undefined ? <span className="max-w-[45%] shrink-0 truncate font-mono text-sm font-medium text-ink-muted">{value}</span> : null}
    </>
  );
}

/** One row: a link, an action, or a label with its own trailing control. */
export function ListRow(props: ListRowProps) {
  const arrow = <ArrowRight aria-hidden className="size-4 shrink-0 text-ink-faint transition-transform duration-[var(--motion-control)] group-hover:translate-x-0.5 group-hover:text-contrast" weight="bold" />;
  if (props.href !== undefined) {
    return (
      <li>
        <AppLink
          className={cn(rowClass, actionClass)}
          href={props.href}
          onClick={props.onClick}
          {...(props.external ? { rel: "noreferrer", target: "_blank" } : {})}
        >
          <RowBody {...props} />
          {arrow}
        </AppLink>
      </li>
    );
  }
  if (props.onClick !== undefined) {
    return (
      <li>
        <button className={cn(rowClass, actionClass)} disabled={props.disabled} onClick={props.onClick} type="button">
          <RowBody {...props} />
          {props.tone === "danger" ? null : arrow}
        </button>
      </li>
    );
  }
  return (
    <li className={rowClass}>
      <RowBody {...props} />
      {props.trailing}
    </li>
  );
}

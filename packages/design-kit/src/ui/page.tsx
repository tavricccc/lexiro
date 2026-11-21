import * as React from "react";
import { AppLink } from "./app-link";
import { ArrowClockwise, ArrowLeft, Tray, WarningCircle } from "@phosphor-icons/react/ssr";
import { cn } from "../lib/utils";
import { Button } from "./button";
import { Skeleton } from "./feedback";
import { Panel } from "./panel";

export const pinnedHeaderClass = "sticky top-0 z-30";

/**
 * Architectural square toolbar button. `prominent` uses International Klein Blue.
 */
export function HeaderButton({ prominent, ...props }: Omit<React.ComponentProps<typeof Button>, "size" | "variant"> & {
  "aria-label": string;
  prominent?: boolean;
}) {
  return <Button {...props} size="icon-sm" variant={prominent ? "primary" : "secondary"} />;
}

/**
 * Swiss editorial page header:
 * Strong flush-left grotesque title anchored by a 2px ink rule, optional back
 * strip above, and crisp right-aligned toolbar controls.
 */
export function PageHeader({ actions, back, className, description, kicker, title }: {
  actions?: React.ReactNode;
  back?: { href: string; label: string };
  className?: string;
  description?: React.ReactNode;
  kicker?: React.ReactNode;
  title: React.ReactNode;
}) {
  return (
    <header className={cn("grid gap-4 border-b-2 border-line-strong pb-5", className)}>
      {back ? (
        <div className="flex items-center justify-between gap-3">
          <AppLink
            back
            className="group inline-flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted transition-colors hover:text-contrast focus-visible:text-contrast"
            href={back.href}
          >
            <ArrowLeft aria-hidden className="size-3.5 transition-transform group-hover:-translate-x-0.5" weight="bold" />
            <span>{back.label}</span>
          </AppLink>
        </div>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0 flex-1 grid gap-1.5">
          {kicker ? <p className="font-mono text-xs font-semibold uppercase tracking-[0.1em] text-contrast">{kicker}</p> : null}
          <h1 className="text-balance text-3xl font-extrabold leading-[1.06] tracking-[-0.03em] text-ink md:text-[2.5rem]">{title}</h1>
          {description ? <p className="max-w-2xl pt-0.5 text-[0.9375rem] leading-relaxed text-ink-muted">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

function StateMessage({ action, description, icon, title, tone = "default" }: {
  action?: React.ReactNode;
  description?: React.ReactNode;
  icon: React.ReactNode;
  title: React.ReactNode;
  tone?: "default" | "danger";
}) {
  return (
    <Panel className={cn("content-in grid gap-5 border-t-2 p-6 md:p-8", tone === "danger" ? "border-t-danger" : "border-t-line-strong")} role={tone === "danger" ? "alert" : undefined}>
      <div className="flex items-start gap-4">
        <span aria-hidden className={cn("grid size-10 shrink-0 place-items-center border [&_svg]:size-5", tone === "danger" ? "border-danger bg-danger/10 text-danger" : "border-line-strong bg-surface-raised text-ink")}>
          {icon}
        </span>
        <div className="grid gap-1">
          <h2 className="text-lg font-bold tracking-[-0.02em]">{title}</h2>
          {description ? <p className="max-w-lg text-[0.9375rem] leading-relaxed text-ink-muted">{description}</p> : null}
        </div>
      </div>
      {action ? <div className="flex flex-wrap gap-2">{action}</div> : null}
    </Panel>
  );
}

export function EmptyState({ action, description, title }: { action?: React.ReactNode; description?: React.ReactNode; title: React.ReactNode }) {
  return <StateMessage action={action} description={description} icon={<Tray />} title={title} />;
}

export function ErrorState({ message, onRetry, retryLabel, title }: {
  message: React.ReactNode;
  onRetry?: () => void;
  retryLabel: string;
  title: React.ReactNode;
}) {
  return (
    <StateMessage
      action={onRetry ? <Button onClick={onRetry}><ArrowClockwise weight="bold" />{retryLabel}</Button> : null}
      description={message}
      icon={<WarningCircle />}
      title={title}
      tone="danger"
    />
  );
}

export function LoadingList({ label, rows = 4 }: { label: string; rows?: number }) {
  return (
    <div aria-busy="true" aria-label={label} className="grid divide-y divide-line border border-line bg-surface" role="status">
      {Array.from({ length: rows }, (_, index) => (
        <div className="grid gap-2.5 p-5" key={index}>
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-3.5 w-1/4" />
        </div>
      ))}
    </div>
  );
}

import * as React from "react";
import { AppLink } from "./app-link";
import { ArrowClockwise, CaretLeft, Tray, WarningCircle } from "@phosphor-icons/react/ssr";
import { cn } from "../lib/utils";
import { Button } from "./button";
import { Skeleton } from "./feedback";
import { Panel } from "./panel";

/** Pins a page's top row under the status bar while the page scrolls beneath it. */
// Pinned at the offset it starts at, so it never shifts when the page begins to scroll.
export const pinnedHeaderClass = "sticky top-[calc(var(--safe-top)+1.5rem)] z-30 md:top-10";

/** Where the pinned toolbar sits: the back control, the small title and the actions share this line. */
const toolbarTop = "top-[calc(var(--safe-top)+0.5rem)] md:top-4";

/**
 * A round, icon-only control for a page's toolbar, like iOS's bar buttons.
 * Give it an `aria-label`; `prominent` is for the one main action.
 */
export function HeaderButton({ prominent, ...props }: Omit<React.ComponentProps<typeof Button>, "size" | "variant"> & {
  "aria-label": string;
  prominent?: boolean;
}) {
  return <Button {...props} size="icon-sm" variant={prominent ? "primary" : "secondary"} />;
}

/**
 * The top of a page. The way back sits top-left and the page's actions
 * top-right, pinned there as the page scrolls; pass the actions as
 * `HeaderButton`s. Like a large title on iOS, the title scrolls away and a
 * small one appears centred between them.
 */
export function PageHeader({ actions, back, className, description, title }: {
  actions?: React.ReactNode;
  /** Where the back control leads, with its accessible name. */
  back?: { href: string; label: string };
  className?: string;
  description?: React.ReactNode;
  title: React.ReactNode;
}) {
  const titleRef = React.useRef<HTMLHeadingElement>(null);
  const [collapsed, setCollapsed] = React.useState(false);
  React.useEffect(() => {
    const title = titleRef.current;
    if (!title) return;
    const observer = new IntersectionObserver(([entry]) => setCollapsed(!entry.isIntersecting && entry.boundingClientRect.top < 0));
    observer.observe(title);
    return () => observer.disconnect();
  }, []);
  const smallTitle = (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none min-w-0 truncate text-center text-[0.9375rem] font-semibold transition-[opacity,translate] duration-[var(--motion-control)] ease-[var(--ease-move)]",
        collapsed ? "opacity-100" : "-translate-y-1 opacity-0",
      )}
    >
      {title}
    </span>
  );
  return (
    <>
    {back || actions ? (
      // Outside the header so it stays pinned for the whole page; the small title is centred on the buttons' line.
      <div className={cn("sticky z-40 -mb-2 grid h-9 grid-cols-[minmax(max-content,1fr)_minmax(0,max-content)_minmax(max-content,1fr)] items-center gap-2", toolbarTop)}>
        <div className="flex">
          {back ? (
            <HeaderButton aria-label={back.label} asChild>
              <AppLink back href={back.href}><CaretLeft weight="bold" /></AppLink>
            </HeaderButton>
          ) : null}
        </div>
        {smallTitle}
        <div className="flex items-center justify-end gap-2">{actions}</div>
      </div>
    ) : (
      <div className="pointer-events-none fixed inset-x-0 top-0 z-30 flex justify-center px-16 pt-[calc(var(--safe-top)+0.5rem)] md:left-70 md:pt-4">
        <div className="flex h-9 min-w-0 items-center">{smallTitle}</div>
      </div>
    )}
    <header className={cn("grid gap-1", className)}>
      <h1 ref={titleRef} className="text-balance text-2xl font-bold leading-tight tracking-tight md:text-[1.75rem]">{title}</h1>
      {description ? <p className="max-w-2xl text-[0.9375rem] leading-relaxed text-ink-muted">{description}</p> : null}
    </header>
    </>
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
    <Panel className="content-in flex flex-col items-center gap-4 px-6 py-10 text-center" role={tone === "danger" ? "alert" : undefined}>
      <span aria-hidden className={cn("grid size-11 place-items-center rounded-full [&_svg]:size-5", tone === "danger" ? "bg-danger/15 text-danger" : "bg-surface-raised text-ink-muted")}>
        {icon}
      </span>
      <div className="grid gap-1">
        <h2 className="text-base font-semibold">{title}</h2>
        {description ? <p className="mx-auto max-w-md text-[0.9375rem] leading-relaxed text-ink-muted">{description}</p> : null}
      </div>
      {action}
    </Panel>
  );
}

export function EmptyState({ action, description, title }: { action?: React.ReactNode; description?: React.ReactNode; title: React.ReactNode }) {
  return <StateMessage action={action} description={description} icon={<Tray />} title={title} />;
}

/** A load that failed, with the reason and a way to try again. */
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

/** Placeholder rows shaped like the record cards that will replace them. */
export function LoadingList({ label, rows = 4 }: { label: string; rows?: number }) {
  return (
    <div aria-busy="true" aria-label={label} className="grid gap-3" role="status">
      {Array.from({ length: rows }, (_, index) => (
        <Panel className="grid gap-3" key={index}>
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
        </Panel>
      ))}
    </div>
  );
}

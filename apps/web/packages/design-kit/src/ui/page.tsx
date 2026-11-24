import * as React from "react";
import { AppLink } from "./app-link";
import { ArrowClockwise, CaretLeft, Tray, WarningCircle, X } from "@phosphor-icons/react/ssr";
import { useLabels } from "../lib/provider";
import { cn } from "../lib/utils";
import { Button } from "./button";
import { Skeleton } from "./feedback";
import { Panel } from "./panel";

/** Where the pinned toolbar sits: the back control, the small title and the actions share this line. */
const toolbarClass = "sticky top-[calc(var(--safe-top)+0.5rem)] z-40 grid h-9 grid-cols-[minmax(max-content,1fr)_minmax(0,max-content)_minmax(max-content,1fr)] items-center gap-2 md:top-[calc(var(--safe-top)+1rem)]";

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
 * small one appears centred between them. On a `sheet` there is only the
 * small one, and the way back is a close button.
 */
export function PageHeader({ actions, back, className, description, sheet = false, title }: {
  actions?: React.ReactNode;
  /** Where the back control leads, with its accessible name. */
  back?: { href: string; label: string };
  className?: string;
  description?: React.ReactNode;
  sheet?: boolean;
  title: React.ReactNode;
}) {
  const labels = useLabels();
  const titleRef = React.useRef<HTMLHeadingElement>(null);
  const [collapsed, setCollapsed] = React.useState(false);
  React.useEffect(() => {
    const title = titleRef.current;
    if (!title) return;
    const observer = new IntersectionObserver(([entry]) => setCollapsed(!entry.isIntersecting && entry.boundingClientRect.top < 0));
    observer.observe(title);
    return () => observer.disconnect();
  }, [sheet]);
  const control = back ? (
    <HeaderButton aria-label={sheet ? labels.close : back.label} asChild>
      <AppLink back href={back.href}>{sheet ? <X weight="bold" /> : <CaretLeft weight="bold" />}</AppLink>
    </HeaderButton>
  ) : null;
  if (sheet)
    return (
      <header className={cn("grid gap-2", className)}>
        <div className={cn(toolbarClass, "top-4 md:top-5")}>
          <div className="flex">{control}</div>
          <h1 className="min-w-0 truncate text-center text-[1.0625rem] font-semibold">{title}</h1>
          <div className="flex items-center justify-end gap-2">{actions}</div>
        </div>
        {description ? <p className="text-center text-[0.9375rem] leading-relaxed text-ink-muted">{description}</p> : null}
      </header>
    );
  const smallTitle = (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none min-w-0 truncate text-center text-[0.9375rem] font-semibold transition-[opacity,translate] duration-[var(--motion-control)] ease-[var(--ease-move)]",
        collapsed ? "opacity-100" : "translate-y-1 opacity-0",
      )}
    >
      {title}
    </span>
  );
  return (
    <>
    {back || actions ? (
      // Outside the header so it stays pinned for the whole page; the small title is centred on the buttons' line.
      // It starts on the line it is pinned to, so it never shifts as the page begins to scroll.
      <div className={cn(toolbarClass, "-mb-2 -mt-4 md:-mt-6")}>
        <div className="flex">{control}</div>
        {smallTitle}
        <div className="flex items-center justify-end gap-2">{actions}</div>
      </div>
    ) : (
      // Takes no room of its own: it lies over the page's first lines, unseen until they have scrolled away.
      <div className={cn(toolbarClass, "pointer-events-none -mb-15 grid-cols-1 justify-items-center px-16")}>{smallTitle}</div>
    )}
    <header className={cn("grid gap-1", className)}>
      <h1 ref={titleRef} className="text-balance text-2xl font-bold leading-tight tracking-tight">{title}</h1>
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

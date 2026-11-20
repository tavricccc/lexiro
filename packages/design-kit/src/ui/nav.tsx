import * as React from "react";
import { AppLink } from "./app-link";
import type { Icon } from "@phosphor-icons/react";
import { cn } from "../lib/utils";

export interface NavItem {
  badge?: boolean;
  href: string;
  icon: Icon;
  label: string;
}

/**
 * The primary destinations, in one of two shapes:
 * - `dock`: the floating bar at the bottom of a phone, icon over label;
 * - `rail`: a column of icon-and-label rows down the side of a wide screen.
 * The current destination wears the same dark pill in both shapes, like the
 * Segmented control, and its icon fills.
 */
export function PrimaryNav({
  activeHref,
  className,
  items,
  label,
  variant,
}: {
  activeHref: string | null;
  className?: string;
  items: NavItem[];
  label: string;
  variant: "dock" | "rail";
}) {
  const activeIndex = items.findIndex((item) => item.href === activeHref);
  return (
    <nav
      aria-label={label}
      className={cn(
        "flex",
        variant === "dock" && "glass-float relative h-[var(--bottom-nav-height)] items-stretch gap-1 rounded-[1.75rem] p-1.5",
        variant === "rail" && "relative flex-col gap-1.5",
        className,
      )}
      style={{ "--nav-count": items.length, "--nav-index": Math.max(activeIndex, 0) } as React.CSSProperties}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute rounded-2xl border-2 border-contrast/25 bg-accent-soft transition-[translate,opacity] duration-[var(--motion-nav)] ease-[var(--ease-bounce)] motion-reduce:transition-none",
          variant === "dock" && "inset-y-1.5 left-1.5 w-[calc((100%-0.75rem-(var(--nav-count)-1)*0.25rem)/var(--nav-count))] translate-x-[calc(var(--nav-index)*(100%+0.25rem))]",
          variant === "rail" && "inset-x-0 top-0 h-13 translate-y-[calc(var(--nav-index)*3.625rem)]",
          activeIndex < 0 && "opacity-0",
        )}
      />
      {items.map(({ badge, href, icon: ItemIcon, label: itemLabel }) => {
        const active = href === activeHref;
        return (
          <AppLink
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative isolate flex min-w-0 items-center rounded-2xl font-bold outline-none transition-[color] duration-[var(--motion-control)] ease-[var(--ease-move)] focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]",
              active ? "text-accent-ink" : "text-ink-faint hover:text-ink-muted",
              variant === "dock" && "flex-1 flex-col justify-center gap-0.5 text-[0.6875rem]",
              variant === "rail" && "h-13 gap-3 px-4 text-base",
            )}
            href={href}
            key={href}
          >
            <span aria-hidden className={cn("relative transition-[scale] duration-[var(--motion-reveal)] ease-[var(--ease-bounce)] group-active:scale-90", active && "scale-110")}>
              <ItemIcon className={variant === "dock" ? "size-6" : "size-6"} weight={active ? "fill" : "bold"} />
              {badge ? <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-surface bg-danger" /> : null}
            </span>
            <span className="max-w-full truncate px-1">{itemLabel}</span>
          </AppLink>
        );
      })}
    </nav>
  );
}

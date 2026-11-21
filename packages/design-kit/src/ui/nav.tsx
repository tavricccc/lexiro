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
 * Swiss International primary navigation:
 * - `rail`: numbered architectural index column on desktop (`01`..`05`), with solid Klein Blue active block;
 * - `dock`: full-width flat grid bar on phones with top Klein Blue indicator rule.
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
  if (variant === "dock") {
    return (
      <nav
        aria-label={label}
        className={cn(
          "grid h-[var(--bottom-nav-height)] w-full grid-cols-5 divide-x divide-line border-t-2 border-line-strong bg-surface",
          className,
        )}
      >
        {items.map(({ badge, href, icon: ItemIcon, label: itemLabel }, index) => {
          const active = href === activeHref;
          return (
            <AppLink
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex min-w-0 flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-semibold tracking-[0.02em] outline-none transition-colors duration-[var(--motion-control)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-contrast",
                active ? "bg-contrast text-on-contrast" : "text-ink-muted hover:bg-surface-raised hover:text-ink",
              )}
              href={href}
              key={href}
            >
              <span aria-hidden className="relative flex items-center gap-1">
                <ItemIcon className="size-[1.125rem]" weight={active ? "fill" : "regular"} />
                {badge ? <span className="absolute -right-1.5 -top-0.5 size-1.5 bg-danger" /> : null}
              </span>
              <span className="max-w-full truncate px-1">{itemLabel}</span>
              <span aria-hidden className="sr-only">{String(index + 1).padStart(2, "0")}</span>
            </AppLink>
          );
        })}
      </nav>
    );
  }

  return (
    <nav aria-label={label} className={cn("flex flex-col border-y border-line divide-y divide-line", className)}>
      {items.map(({ badge, href, icon: ItemIcon, label: itemLabel }, index) => {
        const active = href === activeHref;
        const num = String(index + 1).padStart(2, "0");
        return (
          <AppLink
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex h-12 min-w-0 items-center gap-3 px-4 text-[0.9375rem] font-semibold tracking-[-0.01em] outline-none transition-colors duration-[var(--motion-control)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-contrast",
              active ? "bg-contrast text-on-contrast" : "bg-surface text-ink hover:bg-surface-raised",
            )}
            href={href}
            key={href}
          >
            <span
              aria-hidden
              className={cn(
                "font-mono text-[0.75rem] font-medium tabular-nums",
                active ? "text-on-contrast/80" : "text-ink-faint group-hover:text-contrast",
              )}
            >
              {num}
            </span>
            <span className="min-w-0 flex-1 truncate">{itemLabel}</span>
            <span aria-hidden className="relative shrink-0">
              <ItemIcon className={cn("size-4", active ? "text-on-contrast" : "text-ink-faint group-hover:text-ink")} weight={active ? "fill" : "regular"} />
              {badge ? <span className="absolute -right-1 -top-1 size-1.5 bg-danger" /> : null}
            </span>
          </AppLink>
        );
      })}
    </nav>
  );
}

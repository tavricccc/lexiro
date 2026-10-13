"use client";

import Link from "next/link";
import type { ComponentProps } from "react";

import { canNavigateInPlace, navigate } from "@/lib/app-navigation";

type AppLinkProps = Omit<ComponentProps<typeof Link>, "href" | "prefetch"> & {
  href: string;
};

/**
 * A link that changes screens in place when it stays inside the app, and
 * otherwise behaves as an ordinary link. Modified clicks still open a tab.
 */
export default function AppLink({
  href,
  onClick,
  onNavigate,
  replace,
  target,
  ...props
}: AppLinkProps) {
  return (
    <Link
      {...props}
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || target || event.button !== 0) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
          return;
        if (!canNavigateInPlace(href)) return;
        event.preventDefault();
        let cancelled = false;
        onNavigate?.({ preventDefault: () => void (cancelled = true) });
        if (!cancelled) navigate(href, { replace });
      }}
      onNavigate={onNavigate}
      prefetch={false}
      replace={replace}
      target={target}
    />
  );
}

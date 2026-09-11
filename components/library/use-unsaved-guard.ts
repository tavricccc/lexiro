"use client";

import { useEffect, useState } from "react";

/**
 * Keeps an in-progress form from disappearing under a stray click.
 *
 * The browser's own prompt only covers leaving the site, so in-app links are
 * intercepted here and handed back as a pending destination the caller can put
 * behind a discard dialog. A link that opts out with `data-allow-discard` — the
 * form's own cancel, which already means "leave this" — passes straight through.
 */
export function useUnsavedGuard(dirty: boolean) {
  const [pendingHref, setPendingHref] = useState("");

  useEffect(() => {
    if (!dirty) return;
    const protect = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [dirty]);

  useEffect(() => {
    if (!dirty) return;
    const intercept = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      const anchor = (event.target as Element | null)?.closest(
        "a[href]",
      ) as HTMLAnchorElement | null;
      if (
        !anchor ||
        anchor.dataset.allowDiscard === "true" ||
        anchor.origin !== window.location.origin
      )
        return;
      event.preventDefault();
      setPendingHref(`${anchor.pathname}${anchor.search}${anchor.hash}`);
    };
    document.addEventListener("click", intercept, true);
    return () => document.removeEventListener("click", intercept, true);
  }, [dirty]);

  return { clearPending: () => setPendingHref(""), pendingHref };
}

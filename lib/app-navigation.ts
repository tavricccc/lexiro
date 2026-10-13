/**
 * Moving between screens of the app without asking the server.
 *
 * Every screen under /app is drawn on the client by one view host from the
 * address bar, so a link inside the app only has to change the address: Next
 * keeps `usePathname` and `useSearchParams` in step with `history.pushState`.
 */

const IN_APP = /^\/app(?:[/?#]|$)/u;

let hostMounted = false;

/** Called by the view host while it is on screen. */
export function setViewHostMounted(mounted: boolean) {
  hostMounted = mounted;
}

/** Whether `href` names a screen the view host can draw. */
export function isInAppHref(href: string) {
  return IN_APP.test(href);
}

/** Whether `href` can be shown in place right now. */
export function canNavigateInPlace(href: string) {
  return hostMounted && isInAppHref(href);
}

/**
 * Shows `href` in place. Returns false when the caller must navigate the
 * ordinary way: the view host is not mounted, or `href` leaves the app.
 */
export function navigate(
  href: string,
  { replace = false }: { replace?: boolean } = {},
) {
  if (!canNavigateInPlace(href)) return false;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (replace) window.history.replaceState(null, "", href);
  else if (href !== current) window.history.pushState(null, "", href);
  return true;
}

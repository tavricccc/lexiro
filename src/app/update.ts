/** How long opening waits to hear whether there is a newer version. */
const CHECK_LIMIT_MS = 3_000;
/** How long it waits for that version to download and take over. */
const INSTALL_LIMIT_MS = 30_000;
/** A page left this long may be reloaded when it is looked at again. */
const AWAY_MS = 10 * 60_000;

const supported = () => import.meta.env.PROD && "serviceWorker" in navigator;

const within = <T>(work: Promise<T>, ms: number) =>
  Promise.race([work, new Promise<undefined>((resolve) => setTimeout(resolve, ms))]);

/** Resolves once the worker has finished installing, or failed to. */
function installed(worker: ServiceWorker) {
  return new Promise<void>((resolve) => {
    const settle = () => {
      if (worker.state === "installing") return;
      worker.removeEventListener("statechange", settle);
      resolve();
    };
    worker.addEventListener("statechange", settle);
    settle();
  });
}

/** The waiting version takes over; `then` runs once it has. */
export function applyUpdate(waiting: ServiceWorker, then = () => window.location.reload()) {
  navigator.serviceWorker.addEventListener("controllerchange", then, { once: true });
  waiting.postMessage({ type: "SKIP_WAITING" });
}

/**
 * Opening's own update: checks for a newer version and, when there is one, gets
 * it and reloads into it. Resolves only when the page should open as it is (up
 * to date, offline, first visit, or past a limit); one that installs later waits
 * for the next opening.
 */
export async function updateOnOpen(onUpdating: () => void): Promise<void> {
  if (!supported()) return;
  const registering = navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
  // A first visit has nothing older to replace; the worker installs behind the page.
  if (!navigator.serviceWorker.controller || !navigator.onLine) return;
  const registration = await within(registering, CHECK_LIMIT_MS);
  if (!registration) return;
  if (!registration.waiting && !registration.installing)
    await within(registration.update().catch(() => undefined), CHECK_LIMIT_MS);
  if (!registration.waiting && !registration.installing) return;
  onUpdating();
  let expired = false;
  await within((async () => {
    if (registration.installing) await installed(registration.installing);
    const waiting = registration.waiting;
    if (!waiting || expired) return;
    // Past the limit the page is in use, so a late takeover must not reload it.
    await new Promise<never>(() => applyUpdate(waiting, () => { if (!expired) window.location.reload(); }));
  })(), INSTALL_LIMIT_MS);
  expired = true;
}

/** Keeps a page that stays open for days up to date, never while it is being used. */
export function watchUpdates() {
  if (!supported()) return;
  let hiddenAt = Date.now();
  // Another tab may have moved to a newer version, whose files this page no longer has.
  let stale = false;
  let controlled = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (controlled) stale = true;
    controlled = true;
  });
  document.addEventListener("visibilitychange", async () => {
    if (document.hidden) { hiddenAt = Date.now(); return; }
    if (stale) { window.location.reload(); return; }
    if (Date.now() - hiddenAt < AWAY_MS) return;
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration?.waiting) applyUpdate(registration.waiting);
    else void registration?.update().catch(() => undefined);
  });
}

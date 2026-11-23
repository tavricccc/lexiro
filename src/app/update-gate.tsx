import { useEffect, useState, type ReactNode } from "react";
import { updateOnOpen, watchUpdates } from "./update";

/** Holds the app back while a newer version is looked for and installed. */
export function UpdateGate({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<"checking" | "updating" | "open">(import.meta.env.PROD ? "checking" : "open");
  useEffect(() => {
    if (!import.meta.env.PROD) return;
    let cancelled = false;
    void updateOnOpen(() => { if (!cancelled) setPhase("updating"); })
      .catch(() => undefined)
      .then(() => {
        if (cancelled) return;
        setPhase("open");
        watchUpdates();
      });
    return () => { cancelled = true; };
  }, []);
  if (phase === "open") return children;
  return (
    <div className="launch-canvas fixed inset-0 grid place-items-center">
      <img alt="Lexiro" className="update-mark size-24 rounded-[22.37%]" src="/icons/icon-192.png" />
      {phase === "updating" ? (
        <div className="content-in absolute inset-x-0 top-1/2 mt-24 grid justify-items-center gap-3.5" role="status">
          <span aria-hidden className="update-track h-1 w-40 overflow-hidden rounded-full bg-surface-pressed">
            <i className="block h-full w-2/5 rounded-full bg-contrast" />
          </span>
          <span className="text-[0.9375rem] text-ink-muted">正在更新</span>
        </div>
      ) : null}
    </div>
  );
}

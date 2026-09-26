import type { ReactNode } from "react";

/** The same progress surface for generation and photo organization. */
export function TaskProgress({
  activeFraction = 0,
  children,
  elapsed,
  label,
  max,
  summary,
  title,
  value,
}: {
  activeFraction?: number;
  children?: ReactNode;
  elapsed: string;
  label: string;
  max: number;
  summary: string;
  title: string;
  value: number;
}) {
  const ceiling = Math.max(1, max);
  const completed = Math.min(ceiling, Math.max(0, value));
  const active = Math.min(1, Math.max(0, activeFraction));

  return (
    <section className="rule-card py-4">
      <h2 aria-live="polite" className="type-subsection mb-3">
        {title}
      </h2>
      <div className="flex flex-wrap justify-between gap-2 text-sm tabular-nums">
        <span aria-live="polite">{summary}</span>
        <span className="text-muted-foreground">{elapsed}</span>
      </div>
      <div
        aria-label={label}
        aria-valuemax={ceiling}
        aria-valuemin={0}
        aria-valuenow={completed}
        className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--surface-inset)]"
        role="progressbar"
      >
        {active > 0 && completed < ceiling && (
          <div
            aria-hidden
            className="absolute inset-y-0 bg-primary/25 transition-[width] duration-[var(--motion-control)] ease-[var(--ease-move)]"
            style={{
              left: `${(completed / ceiling) * 100}%`,
              width: `${(active / ceiling) * 100}%`,
            }}
          />
        )}
        <div
          className="relative h-full rounded-full bg-primary transition-[width] duration-[var(--motion-control)] ease-[var(--ease-move)]"
          style={{ width: `${(completed / ceiling) * 100}%` }}
        />
      </div>
      {children && (
        <div className="mt-2 flex flex-wrap justify-between gap-3 text-xs text-muted-foreground">
          {children}
        </div>
      )}
    </section>
  );
}

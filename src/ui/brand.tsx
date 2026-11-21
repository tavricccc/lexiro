import { cn } from "design-kit";

/** The Lexiro Swiss architectural mark and wordmark. */
export function Brand({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-3 select-none", className)}>
      <span
        aria-hidden
        className="grid size-8 shrink-0 place-items-center bg-contrast font-mono text-sm font-bold text-on-contrast"
      >
        LX
      </span>
      <span className="grid leading-none">
        <span className="font-latin text-xl font-black uppercase tracking-[-0.04em] text-ink">Lexiro</span>
        {!compact ? <span className="mt-0.5 font-mono text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-ink-faint">Vocab System</span> : null}
      </span>
    </span>
  );
}

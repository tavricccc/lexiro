import { cn } from "design-kit";

export type Mood = "happy" | "cheer" | "sleepy" | "think";

/** Lexi, a round little bookworm owl. Decorative: it never carries meaning on its own. */
export function Mascot({ mood = "happy", className }: { mood?: Mood; className?: string }) {
  const closed = mood === "sleepy";
  return (
    <svg aria-hidden className={cn("size-24 shrink-0", className)} fill="none" viewBox="0 0 120 120">
      <ellipse cx="60" cy="112" fill="var(--ink)" opacity="0.08" rx="34" ry="5" />
      <g className={mood === "cheer" ? "mascot-hop" : "mascot-bob"}>
        <path d="M30 34 L38 14 L50 30 Z" fill="var(--contrast-edge)" />
        <path d="M90 34 L82 14 L70 30 Z" fill="var(--contrast-edge)" />
        <rect fill="var(--contrast-edge)" height="80" rx="38" width="80" x="20" y="28" />
        <rect fill="var(--contrast)" height="76" rx="36" width="80" x="20" y="26" />
        <ellipse cx="60" cy="80" fill="var(--surface)" opacity="0.9" rx="24" ry="18" />
        <circle cx="45" cy="52" fill="var(--surface)" r="14" />
        <circle cx="75" cy="52" fill="var(--surface)" r="14" />
        {closed ? (
          <>
            <path d="M38 53 Q45 58 52 53" stroke="var(--ink)" strokeLinecap="round" strokeWidth="3.5" />
            <path d="M68 53 Q75 58 82 53" stroke="var(--ink)" strokeLinecap="round" strokeWidth="3.5" />
          </>
        ) : mood === "cheer" ? (
          <>
            <path d="M38 55 Q45 46 52 55" stroke="var(--ink)" strokeLinecap="round" strokeWidth="3.5" />
            <path d="M68 55 Q75 46 82 55" stroke="var(--ink)" strokeLinecap="round" strokeWidth="3.5" />
          </>
        ) : (
          <g className="mascot-blink">
            <circle cx={mood === "think" ? 48 : 46} cy={mood === "think" ? 49 : 53} fill="var(--ink)" r="6" />
            <circle cx={mood === "think" ? 78 : 76} cy={mood === "think" ? 49 : 53} fill="var(--ink)" r="6" />
            <circle cx={mood === "think" ? 50 : 48} cy={mood === "think" ? 47 : 51} fill="var(--surface)" r="2" />
            <circle cx={mood === "think" ? 80 : 78} cy={mood === "think" ? 47 : 51} fill="var(--surface)" r="2" />
          </g>
        )}
        <path d="M55 64 L60 71 L65 64 Z" fill="var(--highlight)" stroke="var(--highlight-edge)" strokeLinejoin="round" strokeWidth="2" />
        <circle cx="33" cy="68" fill="var(--hue-rose)" opacity="0.35" r="5" />
        <circle cx="87" cy="68" fill="var(--hue-rose)" opacity="0.35" r="5" />
        <g transform="translate(40 86)">
          <path d="M0 4 Q10 0 20 4 L20 20 Q10 16 0 20 Z" fill="var(--highlight)" stroke="var(--highlight-edge)" strokeLinejoin="round" strokeWidth="2" />
          <path d="M20 4 Q30 0 40 4 L40 20 Q30 16 20 20 Z" fill="var(--highlight)" stroke="var(--highlight-edge)" strokeLinejoin="round" strokeWidth="2" />
        </g>
        {mood === "sleepy" ? <text fill="var(--ink-faint)" fontFamily="var(--font-latin)" fontSize="16" fontWeight="800" x="92" y="24">z</text> : null}
        {mood === "cheer" ? <path d="M98 20 l3 7 7 1 -5 5 1 7 -6 -3 -6 3 1 -7 -5 -5 7 -1 Z" fill="var(--highlight)" /> : null}
      </g>
    </svg>
  );
}

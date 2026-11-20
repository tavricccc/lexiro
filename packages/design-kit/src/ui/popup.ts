// Anchored popups and the sheets they become on a phone share one surface.
export const popupClass =
  "z-50 rounded-panel border-2 border-line bg-surface-solid text-ink shadow-float outline-none origin-(--transform-origin) transition-[opacity,scale] duration-[var(--motion-control)] ease-[var(--ease-bounce)] data-starting-style:scale-90 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0 data-[presentation=sheet]:rounded-b-none data-[presentation=sheet]:pb-[max(1rem,var(--safe-bottom))] data-[presentation=sheet]:transition-none motion-reduce:transition-none";

export const sheetGrip = "mx-auto mb-2 mt-1 h-1.5 w-10 rounded-full bg-ink-faint/50";

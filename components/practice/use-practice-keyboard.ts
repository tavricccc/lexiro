import { useEffect } from "react";

/**
 * Option keys only pick a choice; Enter confirms it, so a learner can change
 * their mind before anything is scored. The arrows walk back through entries
 * already answered and forward again to the one still open.
 */
export function usePracticeKeyboard({
  enabled,
  selected,
  pendingChoice,
  reviewing,
  canGoBack,
  onSelect,
  onConfirm,
  onNext,
  onPrevious,
  onForward,
  optionCount = 4,
}: {
  enabled: boolean;
  selected: number | null;
  pendingChoice: number | null;
  reviewing: boolean;
  canGoBack: boolean;
  onSelect: (choice: number) => void;
  onConfirm: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onForward: () => void;
  /** A 文意選填 bank can run to ten options, so the letter keys go past D. */
  optionCount?: number;
}) {
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.repeat ||
        event.isComposing ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.shiftKey
      )
        return;
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(
          'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="dialog"], [role="combobox"], [role="listbox"], [role="menu"], [role="tablist"]',
        )
      )
        return;
      if (event.key === "ArrowLeft") {
        if (!canGoBack) return;
        event.preventDefault();
        onPrevious();
        return;
      }
      if (event.key === "ArrowRight") {
        if (!reviewing) return;
        event.preventDefault();
        onForward();
        return;
      }
      if (event.key === "Enter") {
        // A focused control already handles its own Enter, except an option:
        // Enter after tapping one confirms it instead of picking it again.
        const option =
          target instanceof Element &&
          target.closest("[data-practice-option]") !== null;
        if (
          !option &&
          (target instanceof HTMLButtonElement ||
            target instanceof HTMLAnchorElement)
        )
          return;
        if (reviewing) {
          event.preventDefault();
          onForward();
        } else if (selected !== null) {
          event.preventDefault();
          onNext();
        } else if (pendingChoice !== null) {
          event.preventDefault();
          onConfirm();
        }
        return;
      }
      if (reviewing || selected !== null) return;
      const key = event.key.toLocaleLowerCase();
      const digits = Array.from(
        { length: Math.min(optionCount, 9) },
        (_, index) => String(index + 1),
      );
      const letters = Array.from({ length: optionCount }, (_, index) =>
        String.fromCharCode(97 + index),
      );
      const choice =
        digits.indexOf(key) >= 0 ? digits.indexOf(key) : letters.indexOf(key);
      if (choice >= 0) {
        event.preventDefault();
        onSelect(choice);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    canGoBack,
    enabled,
    onConfirm,
    onForward,
    onNext,
    onPrevious,
    onSelect,
    optionCount,
    pendingChoice,
    reviewing,
    selected,
  ]);
}

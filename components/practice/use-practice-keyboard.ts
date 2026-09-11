"use client";

import type { ReviewRating } from "@/types";
import { useEffect } from "react";

/**
 * Which shortcuts are live follows the entry under the cursor, not the session:
 * a card answers to Enter/A/G and a question to the option keys, and a mixed
 * queue swaps between them as it advances.
 */
export function usePracticeKeyboard({
  enabled,
  kind,
  revealed,
  selected,
  busy,
  onReveal,
  onRate,
  onAnswer,
  onNext,
  optionCount = 4,
}: {
  enabled: boolean;
  kind: "card" | "question";
  revealed: boolean;
  selected: number | null;
  busy: boolean;
  onReveal: () => void;
  onRate: (rating: ReviewRating) => void;
  onAnswer: (choice: number) => void;
  onNext: () => void;
  /** A 文意選填 bank can run to ten options, so the letter keys go past D. */
  optionCount?: number;
}) {
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement
      )
        return;
      const nativeEnterControl =
        event.key === "Enter" &&
        (target instanceof HTMLButtonElement ||
          target instanceof HTMLAnchorElement);
      if (nativeEnterControl) return;
      if (kind === "card") {
        if (!revealed && event.key === "Enter") {
          event.preventDefault();
          onReveal();
        } else if (revealed && event.key.toLocaleLowerCase() === "a") {
          event.preventDefault();
          onRate("again");
        } else if (revealed && event.key.toLocaleLowerCase() === "g") {
          event.preventDefault();
          onRate("good");
        }
        return;
      }
      const key = event.key.toLocaleLowerCase();
      const digits = Array.from({ length: Math.min(optionCount, 9) }, (_, index) =>
        String(index + 1),
      );
      const letters = Array.from({ length: optionCount }, (_, index) =>
        String.fromCharCode(97 + index),
      );
      const choice =
        digits.indexOf(key) >= 0 ? digits.indexOf(key) : letters.indexOf(key);
      if (selected === null && choice >= 0) {
        event.preventDefault();
        onAnswer(choice);
      } else if (selected !== null && !busy && event.key === "Enter") {
        event.preventDefault();
        onNext();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    busy,
    enabled,
    kind,
    onAnswer,
    onNext,
    onRate,
    onReveal,
    optionCount,
    revealed,
    selected,
  ]);
}

"use client";

import type { ReviewRating, WorkspacePracticeMode } from "@/types";
import { useEffect } from "react";

export function usePracticeKeyboard({
  enabled,
  mode,
  revealed,
  selected,
  busy,
  onReveal,
  onRate,
  onAnswer,
  onNext,
}: {
  enabled: boolean;
  mode: WorkspacePracticeMode;
  revealed: boolean;
  selected: number | null;
  busy: boolean;
  onReveal: () => void;
  onRate: (rating: ReviewRating) => void;
  onAnswer: (choice: number) => void;
  onNext: () => void;
}) {
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const nativeEnterControl = event.key === "Enter" && (target instanceof HTMLButtonElement || target instanceof HTMLAnchorElement);
      if (nativeEnterControl) return;
      if (mode === "review") {
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
      const choices = ["1", "2", "3", "4", "a", "b", "c", "d"];
      const choice = choices.indexOf(event.key.toLocaleLowerCase());
      if (selected === null && choice >= 0) {
        event.preventDefault();
        onAnswer(choice % 4);
      } else if (selected !== null && !busy && event.key === "Enter") {
        event.preventDefault();
        onNext();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, enabled, mode, onAnswer, onNext, onRate, onReveal, revealed, selected]);
}

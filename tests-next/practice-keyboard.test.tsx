import { fireEvent, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { usePracticeKeyboard } from "@/components/practice/use-practice-keyboard";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("practice keyboard shortcuts", () => {
  it("does not double-advance when Enter belongs to a focused button", () => {
    const onNext = vi.fn();
    renderHook(() => usePracticeKeyboard({
      enabled: true,
      mode: "questions",
      revealed: true,
      selected: 1,
      busy: false,
      onReveal: vi.fn(),
      onRate: vi.fn(),
      onAnswer: vi.fn(),
      onNext,
    }));
    const button = document.createElement("button");
    document.body.append(button);
    button.focus();
    fireEvent.keyDown(button, { key: "Enter" });
    expect(onNext).not.toHaveBeenCalled();
  });

  it("advances once from the global Enter shortcut when focus is not on a button", () => {
    const onNext = vi.fn();
    renderHook(() => usePracticeKeyboard({
      enabled: true,
      mode: "questions",
      revealed: true,
      selected: 1,
      busy: false,
      onReveal: vi.fn(),
      onRate: vi.fn(),
      onAnswer: vi.fn(),
      onNext,
    }));
    fireEvent.keyDown(window, { key: "Enter" });
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});

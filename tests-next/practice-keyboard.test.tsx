import { cleanup, fireEvent, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { usePracticeKeyboard } from "@/components/practice/use-practice-keyboard";

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

describe("practice keyboard shortcuts", () => {
  it.each([
    { ctrlKey: true },
    { metaKey: true },
    { altKey: true },
    { shiftKey: true },
    { repeat: true },
    { isComposing: true },
  ])("ignores modified, repeated and composing keys: %j", (modifiers) => {
    const onAnswer = vi.fn();
    renderHook(() =>
      usePracticeKeyboard({
        enabled: true,
        selected: null,
        busy: false,
        onAnswer,
        onNext: vi.fn(),
      }),
    );
    fireEvent.keyDown(window, { key: "a", ...modifiers });
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it("does not answer while saving", () => {
    const onAnswer = vi.fn();
    renderHook(() =>
      usePracticeKeyboard({
        enabled: true,
        selected: null,
        busy: true,
        onAnswer,
        onNext: vi.fn(),
      }),
    );
    fireEvent.keyDown(window, { key: "a" });
    fireEvent.keyDown(window, { key: "1" });
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it.each([
    '<div contenteditable="true"><span></span></div>',
    '<div role="dialog"><span></span></div>',
    "<select><option>One</option></select>",
  ])("leaves editing and modal keys alone: %s", (html) => {
    const onAnswer = vi.fn();
    renderHook(() =>
      usePracticeKeyboard({
        enabled: true,
        selected: null,
        busy: false,
        onAnswer,
        onNext: vi.fn(),
      }),
    );
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.append(container);
    fireEvent.keyDown(container.querySelector("span, select")!, { key: "a" });
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it("does not double-advance when Enter belongs to a focused button", () => {
    const onNext = vi.fn();
    renderHook(() =>
      usePracticeKeyboard({
        enabled: true,
        selected: 1,
        busy: false,
        onAnswer: vi.fn(),
        onNext,
      }),
    );
    const button = document.createElement("button");
    document.body.append(button);
    button.focus();
    fireEvent.keyDown(button, { key: "Enter" });
    expect(onNext).not.toHaveBeenCalled();
  });

  it("advances once from the global Enter shortcut when focus is not on a button", () => {
    const onNext = vi.fn();
    renderHook(() =>
      usePracticeKeyboard({
        enabled: true,
        selected: 1,
        busy: false,
        onAnswer: vi.fn(),
        onNext,
      }),
    );
    fireEvent.keyDown(window, { key: "Enter" });
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});

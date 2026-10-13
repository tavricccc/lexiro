import { cleanup, fireEvent, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { usePracticeKeyboard } from "@/components/practice/use-practice-keyboard";

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

function setup(overrides: Partial<Parameters<typeof usePracticeKeyboard>[0]>) {
  const handlers = {
    onSelect: vi.fn(),
    onConfirm: vi.fn(),
    onNext: vi.fn(),
    onPrevious: vi.fn(),
    onForward: vi.fn(),
  };
  renderHook(() =>
    usePracticeKeyboard({
      enabled: true,
      selected: null,
      pendingChoice: null,
      reviewing: false,
      canGoBack: false,
      ...handlers,
      ...overrides,
    }),
  );
  return handlers;
}

describe("practice keyboard shortcuts", () => {
  it.each([
    { ctrlKey: true },
    { metaKey: true },
    { altKey: true },
    { shiftKey: true },
    { repeat: true },
    { isComposing: true },
  ])("ignores modified, repeated and composing keys: %j", (modifiers) => {
    const { onSelect } = setup({});
    fireEvent.keyDown(window, { key: "a", ...modifiers });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("picks an option without confirming it", () => {
    const { onSelect, onConfirm } = setup({});
    fireEvent.keyDown(window, { key: "2" });
    expect(onSelect).toHaveBeenCalledWith(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("confirms a pending choice with Enter, including from a focused option", () => {
    const { onConfirm } = setup({ pendingChoice: 1 });
    fireEvent.keyDown(window, { key: "Enter" });
    const option = document.createElement("button");
    option.dataset.practiceOption = "";
    document.body.append(option);
    option.focus();
    fireEvent.keyDown(option, { key: "Enter" });
    expect(onConfirm).toHaveBeenCalledTimes(2);
  });

  it("does nothing on Enter before an option is picked", () => {
    const handlers = setup({});
    fireEvent.keyDown(window, { key: "Enter" });
    expect(handlers.onConfirm).not.toHaveBeenCalled();
    expect(handlers.onNext).not.toHaveBeenCalled();
  });

  it.each([
    '<div contenteditable="true"><span></span></div>',
    '<div role="dialog"><span></span></div>',
    '<div role="tablist"><span></span></div>',
    "<select><option>One</option></select>",
  ])("leaves editing and modal keys alone: %s", (html) => {
    const { onSelect, onPrevious } = setup({ canGoBack: true });
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.append(container);
    const target = container.querySelector("span, select")!;
    fireEvent.keyDown(target, { key: "a" });
    fireEvent.keyDown(target, { key: "ArrowLeft" });
    expect(onSelect).not.toHaveBeenCalled();
    expect(onPrevious).not.toHaveBeenCalled();
  });

  it("does not double-advance when Enter belongs to a focused button", () => {
    const { onNext } = setup({ selected: 1 });
    const button = document.createElement("button");
    document.body.append(button);
    button.focus();
    fireEvent.keyDown(button, { key: "Enter" });
    expect(onNext).not.toHaveBeenCalled();
  });

  it("advances once from the global Enter shortcut when focus is not on a button", () => {
    const { onNext } = setup({ selected: 1 });
    fireEvent.keyDown(window, { key: "Enter" });
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("walks back with ArrowLeft and forward with ArrowRight or Enter while reviewing", () => {
    const handlers = setup({ reviewing: true, canGoBack: true });
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.keyDown(window, { key: "Enter" });
    fireEvent.keyDown(window, { key: "1" });
    expect(handlers.onPrevious).toHaveBeenCalledTimes(1);
    expect(handlers.onForward).toHaveBeenCalledTimes(2);
    expect(handlers.onSelect).not.toHaveBeenCalled();
  });

  it("ignores ArrowLeft on the first entry", () => {
    const { onPrevious } = setup({});
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(onPrevious).not.toHaveBeenCalled();
  });
});

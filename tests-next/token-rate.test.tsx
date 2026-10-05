import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useTokenRate } from "@/components/ai/use-token-rate";

afterEach(() => vi.useRealTimers());

it("updates every 100 ms using only the preceding 500 ms and resets between turns", () => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "performance"] });
  const { result, rerender } = renderHook(
    ({ tokens, active }) => useTokenRate(tokens, active),
    { initialProps: { tokens: 0, active: true } },
  );
  rerender({ tokens: 10, active: true });
  act(() => vi.advanceTimersByTime(99));
  expect(result.current).toBe(0);
  act(() => vi.advanceTimersByTime(1));
  expect(result.current).toBe(20);
  act(() => vi.advanceTimersByTime(400));
  expect(result.current).toBe(20);
  act(() => vi.advanceTimersByTime(100));
  expect(result.current).toBe(0);
  rerender({ tokens: 15, active: true });
  act(() => vi.advanceTimersByTime(100));
  expect(result.current).toBe(10);
  rerender({ tokens: 0, active: true });
  act(() => vi.advanceTimersByTime(100));
  expect(result.current).toBe(0);
  rerender({ tokens: 4, active: true });
  act(() => vi.advanceTimersByTime(100));
  expect(result.current).toBe(8);
  rerender({ tokens: 4, active: false });
  expect(result.current).toBe(0);
});

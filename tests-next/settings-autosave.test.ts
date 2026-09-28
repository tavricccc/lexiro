import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useAutosave } from "@/components/me/use-autosave";

afterEach(cleanup);
it("saves the latest value when an edit is reverted during the debounce", async () => {
  const save = vi.fn().mockResolvedValue(undefined);
  const { result, rerender } = renderHook(
    ({ value }) => useAutosave(value, save, { delay: 20 }),
    { initialProps: { value: 15 } },
  );
  rerender({ value: 16 });
  rerender({ value: 15 });
  await waitFor(() => expect(result.current.status).toBe("saved"));
  expect(save.mock.calls).toEqual([[15]]);
});
it("reports failed settings saves and retries the same value only when asked", async () => {
  const save = vi
    .fn()
    .mockRejectedValueOnce(new Error("disk full"))
    .mockResolvedValue(undefined);
  const { result, rerender } = renderHook(
    ({ value }) => useAutosave(value, save, { delay: 0 }),
    { initialProps: { value: 10 } },
  );
  rerender({ value: 20 });
  await waitFor(() => expect(result.current.status).toBe("error"));
  expect(save).toHaveBeenCalledTimes(1);
  act(() => result.current.retry());
  await waitFor(() => expect(result.current.status).toBe("saved"));
  expect(save.mock.calls).toEqual([[20], [20]]);
});

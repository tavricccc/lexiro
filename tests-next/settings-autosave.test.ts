import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useAutosave } from "@/components/me/use-autosave";
import { parseGoalPatch } from "@/src/lib/preference-drafts";
import { setStorageNamespace } from "@/src/lib/persist";
import { flushAccountDataActions } from "@/src/lib/account-data-queue";

const options = { key: "goals", parse: parseGoalPatch, delay: 0 };
const draftKey = "guest:lexiro_pending_goals_v1";
beforeEach(() => {
  localStorage.clear();
  setStorageNamespace("guest");
});
afterEach(async () => {
  cleanup();
  await flushAccountDataActions();
  vi.restoreAllMocks();
});
it("saves the latest value when an edit is reverted during the debounce", async () => {
  const save = vi.fn().mockResolvedValue(undefined);
  const { result } = renderHook(() =>
    useAutosave(save, { ...options, delay: 20 }),
  );
  act(() => {
    result.current.update({ dailyWordGoal: 16 });
    result.current.update({ dailyWordGoal: 15 });
  });
  await waitFor(() => expect(result.current.status).toBe("saved"));
  expect(save.mock.calls).toEqual([[{ dailyWordGoal: 15 }]]);
  expect(localStorage.getItem(draftKey)).toBeNull();
});
it("retains failed settings across returning and resumes only when asked", async () => {
  const save = vi
    .fn()
    .mockRejectedValueOnce(new Error("disk full"))
    .mockResolvedValue(undefined);
  const first = renderHook(() => useAutosave(save, options));
  act(() => first.result.current.update({ dailyWordGoal: 20 }));
  await waitFor(() => expect(first.result.current.status).toBe("error"));
  first.unmount();
  const { result } = renderHook(() => useAutosave(save, options));
  expect(result.current.recovery).toBe("offer");
  expect(result.current.value).toEqual({ dailyWordGoal: 20 });
  expect(save).toHaveBeenCalledTimes(1);
  act(() => result.current.retry());
  await waitFor(() => expect(result.current.status).toBe("saved"));
  expect(save.mock.calls).toEqual([
    [{ dailyWordGoal: 20 }],
    [{ dailyWordGoal: 20 }],
  ]);
});

it("flushes when the app is hidden rather than waiting for pagehide", async () => {
  const save = vi.fn().mockResolvedValue(undefined);
  const { result } = renderHook(() =>
    useAutosave(save, { ...options, delay: 60_000 }),
  );
  act(() => result.current.update({ dailyQuestionGoal: 30 }));
  expect(JSON.parse(localStorage.getItem(draftKey)!).value).toEqual({
    dailyQuestionGoal: 30,
  });
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  await waitFor(() => expect(result.current.status).toBe("saved"));
  expect(save).toHaveBeenCalledTimes(1);
});

it("acknowledges saved fields without losing a newer field edited during the write", async () => {
  let finish!: () => void;
  const save = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValue(undefined);
  const { result } = renderHook(() => useAutosave(save, options));
  act(() => result.current.update({ dailyWordGoal: 20 }));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  act(() => result.current.update({ dailyQuestionGoal: 30 }));
  await act(async () => finish());
  await waitFor(() => expect(result.current.status).toBe("saved"));
  expect(save.mock.calls).toEqual([
    [{ dailyWordGoal: 20 }],
    [{ dailyQuestionGoal: 30 }],
  ]);
});

it("never writes a pending edit into an account switched before the debounce", async () => {
  const save = vi.fn().mockResolvedValue(undefined);
  const { result } = renderHook(() =>
    useAutosave(save, { ...options, delay: 20 }),
  );
  act(() => result.current.update({ dailyWordGoal: 20 }));
  setStorageNamespace("other-account");
  await waitFor(() => expect(result.current.status).toBe("error"));
  expect(save).not.toHaveBeenCalled();
  expect(localStorage.getItem(draftKey)).not.toBeNull();
});

it("does not apply invalid draft fields and explicitly clears only pending changes", () => {
  localStorage.setItem(
    draftKey,
    JSON.stringify({ version: 1, id: "test", value: { dailyWordGoal: -1 } }),
  );
  const save = vi.fn().mockResolvedValue(undefined);
  const { result } = renderHook(() => useAutosave(save, options));
  expect(result.current.recovery).toBe("invalid");
  act(() => result.current.discard());
  expect(result.current.recovery).toBe("active");
  expect(localStorage.getItem(draftKey)).toBeNull();
  expect(save).not.toHaveBeenCalled();
});

it("keeps the pending source when acknowledging its saved write fails, allowing retry", async () => {
  const save = vi.fn().mockResolvedValue(undefined);
  const { result } = renderHook(() => useAutosave(save, options));
  const remove = vi
    .spyOn(Storage.prototype, "removeItem")
    .mockImplementationOnce(() => {
      throw new Error("storage unavailable");
    });
  act(() => result.current.update({ dailyWordGoal: 25 }));
  await waitFor(() => expect(result.current.status).toBe("error"));
  expect(result.current.draftError).toBe(true);
  expect(localStorage.getItem(draftKey)).not.toBeNull();
  remove.mockRestore();
  act(() => result.current.retry());
  await waitFor(() => expect(result.current.status).toBe("saved"));
  expect(localStorage.getItem(draftKey)).toBeNull();
});

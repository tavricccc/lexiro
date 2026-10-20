import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DRAFT_WRITE_DELAY_MS,
  useResumableDraft,
} from "@/lib/use-resumable-draft";

const pause = () =>
  act(() => new Promise((done) => setTimeout(done, DRAFT_WRITE_DELAY_MS + 50)));

const key = "lexiro:flow-draft:v1:test:questions";
const initial = { step: "configure", amount: 10 };

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("resumable flow drafts", () => {
  it("offers a saved step on reentry and resumes its values", async () => {
    const first = renderHook(() => useResumableDraft(key, initial));
    await waitFor(() => expect(first.result.current.status).toBe("active"));
    act(() => first.result.current.update({ step: "review", amount: 27 }));
    expect(first.result.current.persistence).toBe("saved");
    first.unmount();

    const second = renderHook(() => useResumableDraft(key, initial));
    await waitFor(() => expect(second.result.current.status).toBe("offer"));
    expect(second.result.current.draft).toEqual(initial);
    expect(second.result.current.pending).toEqual({
      step: "review",
      amount: 27,
    });
    act(() => second.result.current.resume());
    expect(second.result.current.draft).toEqual({ step: "review", amount: 27 });
    expect(second.result.current.persistence).toBe("saved");
  });

  it("lets the user discard a saved run and begin again", async () => {
    localStorage.setItem(
      key,
      JSON.stringify({
        schemaVersion: 1,
        value: { step: "review", amount: 27 },
      }),
    );
    const { result } = renderHook(() => useResumableDraft(key, initial));
    await waitFor(() => expect(result.current.status).toBe("offer"));
    act(() => result.current.restart());
    expect(result.current.status).toBe("active");
    expect(result.current.draft).toEqual(initial);
    expect(localStorage.getItem(key)).toBeNull();
  });

  it("keeps the current edit visible and reports when local saving fails", async () => {
    const { result } = renderHook(() => useResumableDraft(key, initial));
    await waitFor(() => expect(result.current.status).toBe("active"));
    vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });

    act(() => result.current.update({ amount: 12 }));
    expect(result.current.draft.amount).toBe(12);
    await pause();
    expect(result.current.persistence).toBe("error");

    act(() => result.current.update({ amount: 13 }));
    expect(result.current.persistence).toBe("saved");
    await pause();
    expect(JSON.parse(localStorage.getItem(key) ?? "null").value.amount).toBe(
      13,
    );
  });

  it("writes once typing pauses, and right away when the flow closes", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const { result, unmount } = renderHook(() =>
      useResumableDraft(key, initial),
    );
    await waitFor(() => expect(result.current.status).toBe("active"));
    act(() => result.current.update({ amount: 11 }));
    act(() => result.current.update({ amount: 12 }));
    act(() => result.current.update({ amount: 13 }));
    expect(setItem).not.toHaveBeenCalled();
    await pause();
    expect(setItem).toHaveBeenCalledOnce();

    act(() => result.current.update({ amount: 14 }));
    unmount();
    expect(setItem).toHaveBeenCalledTimes(2);
    expect(JSON.parse(localStorage.getItem(key) ?? "null").value.amount).toBe(
      14,
    );
  });

  it("does not bring a cleared draft back with a late write", async () => {
    const { result } = renderHook(() => useResumableDraft(key, initial));
    await waitFor(() => expect(result.current.status).toBe("active"));
    act(() => result.current.update({ amount: 15 }));
    act(() => result.current.clear());
    await pause();
    expect(localStorage.getItem(key)).toBeNull();
  });
});

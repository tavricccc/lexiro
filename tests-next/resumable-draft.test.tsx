import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useResumableDraft } from "@/components/ai/use-resumable-draft";

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
    expect(second.result.current.pending).toEqual({ step: "review", amount: 27 });
    act(() => second.result.current.resume());
    expect(second.result.current.draft).toEqual({ step: "review", amount: 27 });
    expect(second.result.current.persistence).toBe("saved");
  });

  it("lets the user discard a saved run and begin again", async () => {
    localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, value: { step: "review", amount: 27 } }));
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
    expect(result.current.persistence).toBe("error");

    act(() => result.current.update({ amount: 13 }));
    expect(result.current.persistence).toBe("saved");
    expect(JSON.parse(localStorage.getItem(key) ?? "null").value.amount).toBe(13);
  });
});

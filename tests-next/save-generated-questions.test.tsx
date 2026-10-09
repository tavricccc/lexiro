import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSaveGeneratedQuestions } from "@/components/questions/use-save-generated-questions";
import type { LibraryQuestion } from "@/types";

const { saveQuestion, success, error } = vi.hoisted(() => ({
  saveQuestion: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock("@/stores/library-store", () => ({
  useLibraryStore: (select: (state: unknown) => unknown) =>
    select({ saveQuestion }),
}));
vi.mock("sonner", () => ({ toast: { success, error } }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("saving reviewed questions", () => {
  it("keeps partial-save feedback until an idempotent retry succeeds", async () => {
    const onDone = vi.fn();
    const questions = [
      { id: "a" },
      { id: "b" },
      { id: "c" },
    ] as LibraryQuestion[];
    saveQuestion
      .mockResolvedValueOnce("saved")
      .mockRejectedValueOnce(new Error("storage unavailable"));
    const { result } = renderHook(() => useSaveGeneratedQuestions(onDone));
    await act(async () => {
      await result.current.save(questions);
    });
    expect(result.current.saveError).toContain("已加入 1 題");
    expect(result.current.saveError).toContain("其他結果仍保留在草稿");
    expect(result.current.saveError).not.toContain("storage unavailable");
    expect(result.current.saveDiagnostic).toBe("storage unavailable");
    expect(onDone).not.toHaveBeenCalled();
    saveQuestion
      .mockResolvedValueOnce("duplicate")
      .mockResolvedValueOnce("saved")
      .mockResolvedValueOnce("saved");
    await act(async () => {
      await result.current.save(questions);
    });
    expect(result.current.saveError).toBe("");
    expect(result.current.saveDiagnostic).toBe("");
    expect(onDone).toHaveBeenCalledOnce();
    expect(success).toHaveBeenCalledOnce();
  });
});

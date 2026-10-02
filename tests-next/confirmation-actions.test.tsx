import { useState } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataSection } from "@/components/me/data-section";
import { createFullBackup } from "@/src/lib/full-backup";
import { emptyLibraryState } from "@/src/lib/library-repository";
import { useLibraryStore } from "@/stores/library-store";
import { useLearningStore } from "@/stores/learning-store";
import type { FullBackupPayload } from "@/types";

const { readBackup, success } = vi.hoisted(() => ({
  readBackup: vi.fn(),
  success: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success, error: vi.fn() } }));
vi.mock("@/src/lib/full-backup", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/src/lib/full-backup")>()),
  readFullBackup: readBackup,
}));

const originalLibraryImport = useLibraryStore.getState().importState;
const originalLearningImport = useLearningStore.getState().importState;
beforeEach(() => {
  vi.clearAllMocks();
  useLibraryStore.setState({ state: emptyLibraryState(), status: "ready" });
});
afterEach(() => {
  cleanup();
  useLibraryStore.setState({ importState: originalLibraryImport });
  useLearningStore.setState({ importState: originalLearningImport });
});

describe("confirmation action feedback", () => {
  it("blocks duplicate submissions and dismissal while running, then keeps the error and allows retry", async () => {
    let rejectAction!: (reason: Error) => void;
    const action = vi.fn(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectAction = reject;
        }),
    );
    function Host() {
      const [open, setOpen] = useState(true);
      return (
        <ConfirmDialog
          open={open}
          onOpenChange={setOpen}
          title="Delete set"
          description="Delete this set?"
          confirmLabel="Delete"
          onConfirm={action}
        />
      );
    }
    render(<Host />);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    const processing = screen.getByRole("button", { name: "正在處理…" });
    expect(processing).toBeDisabled();
    expect(screen.getByRole("button", { name: "取消" })).toBeDisabled();
    fireEvent.click(processing);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(action).toHaveBeenCalledOnce();
    expect(screen.getByRole("dialog")).toBeVisible();

    await act(async () => rejectAction(new Error("儲存空間不足")));
    expect(screen.getByRole("alert")).toHaveTextContent("儲存空間不足");
    const retry = screen.getByRole("button", { name: "重試" });
    expect(retry).toHaveFocus();
    expect(retry).toBeEnabled();
    action.mockResolvedValueOnce();
    fireEvent.click(retry);
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(action).toHaveBeenCalledTimes(2);
  });

  it("shows backup reading progress and retains the prepared import when the second save fails", async () => {
    let finishReading!: (backup: FullBackupPayload) => void;
    readBackup.mockImplementationOnce(
      () =>
        new Promise<FullBackupPayload>((resolve) => {
          finishReading = resolve;
        }),
    );
    const libraryImport = vi.fn().mockResolvedValue(undefined);
    const learningImport = vi
      .fn()
      .mockRejectedValueOnce(new Error("學習紀錄無法儲存"))
      .mockResolvedValue(undefined);
    useLibraryStore.setState({ importState: libraryImport });
    useLearningStore.setState({ importState: learningImport });
    const backup = createFullBackup(
      useLibraryStore.getState().state,
      useLearningStore.getState().progress,
      useLearningStore.getState().stats,
    );
    render(<DataSection />);
    fireEvent.change(screen.getByLabelText("匯入備份", { selector: "input" }), {
      target: { files: [new File(["fixture"], "backup.zip")] },
    });
    expect(
      screen.getByRole("button", { name: "正在讀取備份…" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "匯出完整備份" })).toBeDisabled();
    await act(async () => finishReading(backup));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "匯入備份" }));
    await screen.findByRole("alert");
    expect(screen.getByRole("alert")).toHaveTextContent("學習紀錄無法儲存");
    expect(success).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "重試" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(libraryImport).toHaveBeenCalledTimes(2);
    expect(learningImport).toHaveBeenCalledTimes(2);
    expect(libraryImport.mock.calls[1]).toEqual(libraryImport.mock.calls[0]);
    expect(success).toHaveBeenCalledWith("備份已匯入");
  });
});

import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LibraryPage } from "@/components/library/library-page";
import { TooltipProvider } from "@/components/ui/tooltip";
import { UNCATEGORIZED_FOLDER_ID } from "@/src/lib/folders";
import { emptyLibraryState } from "@/src/lib/library-repository";
import { useLibraryStore } from "@/stores/library-store";
import { render } from "./render";

const timestamp = "2026-10-02T00:00:00.000Z";

function library() {
  const state = emptyLibraryState();
  state.sets = ["Alpha", "Beta", "Gamma"].map((setName, index) => ({
    id: setName.toLowerCase(),
    setName,
    order: index * 1024,
    folderId: UNCATEGORIZED_FOLDER_ID,
    createdAt: timestamp,
    updatedAt: timestamp,
  }));
  return state;
}

afterEach(cleanup);

describe("set actions in the library", () => {
  it("deletes the set whose row was right-clicked, after a confirmation", async () => {
    const deleteSet = vi.fn(async () => undefined);
    useLibraryStore.setState({ state: library(), status: "ready", deleteSet });
    render(
      <TooltipProvider>
        <LibraryPage />
      </TooltipProvider>,
      { path: "/app/library" },
    );

    fireEvent.contextMenu(screen.getByRole("link", { name: /Beta/ }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "刪除" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Beta");
    expect(deleteSet).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "刪除" }));
    await waitFor(() => expect(deleteSet).toHaveBeenCalledWith("beta"));
  });

  it("starts practice on the row's set", async () => {
    useLibraryStore.setState({ state: library(), status: "ready" });
    const { router } = render(
      <TooltipProvider>
        <LibraryPage />
      </TooltipProvider>,
      { path: "/app/library" },
    );

    fireEvent.contextMenu(screen.getByRole("link", { name: /Alpha/ }));
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "開始練這組字" }),
    );
    await waitFor(() =>
      expect(
        router.state.location.pathname + router.state.location.search,
      ).toBe("/app/practice?set=alpha"),
    );
  });

  it("reorders a set with the arrow keys on its handle in reorder mode", async () => {
    const reorderSets = vi.fn(async () => undefined);
    useLibraryStore.setState({
      state: library(),
      status: "ready",
      reorderSets,
    });
    render(
      <TooltipProvider>
        <LibraryPage />
      </TooltipProvider>,
      { path: "/app/library" },
    );

    fireEvent.keyDown(screen.getByRole("button", { name: "更多動作" }), {
      key: "Enter",
    });
    fireEvent.click(await screen.findByRole("menuitem", { name: "重新排序" }));
    const handle = screen.getByRole("button", { name: "拖動「Alpha」" });
    fireEvent.keyDown(handle, { key: "ArrowDown" });
    // Alpha lands between Beta (1024) and Gamma (2048).
    expect(reorderSets).toHaveBeenCalledWith([{ id: "alpha", order: 1536 }]);
    fireEvent.click(screen.getByRole("button", { name: "完成" }));
    expect(screen.queryByRole("button", { name: "拖動「Alpha」" })).toBeNull();
  });
});

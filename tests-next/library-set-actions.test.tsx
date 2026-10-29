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
  state.sets = ["Alpha", "Beta"].map((setName) => ({
    id: setName.toLowerCase(),
    setName,
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
});

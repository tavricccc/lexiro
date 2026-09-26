import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SetEditor } from "@/components/library/set-editor";
import { useLibraryStore } from "@/stores/library-store";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

beforeEach(() => {
  localStorage.clear();
  useLibraryStore.setState({ status: "ready" });
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

afterEach(cleanup);

describe("manual set validation", () => {
  it("takes the learner from the fixed save action to the first missing field", async () => {
    render(<SetEditor />);
    fireEvent.click(await screen.findByRole("button", { name: /手動輸入/ }));

    const word = screen.getByRole("textbox", { name: "英文單字" });
    fireEvent.click(screen.getByRole("button", { name: "儲存單字" }));

    await waitFor(() => expect(word).toHaveFocus());
    expect(word).toHaveAttribute("aria-invalid", "true");
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
    expect(screen.getByRole("alert", { name: "" })).toHaveTextContent(
      "已帶你到第一個需要補齊的位置",
    );
  });
});

import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { render } from "./render";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SetEditor } from "@/components/library/set-editor";
import { useLibraryStore } from "@/stores/library-store";

vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useNavigate: () => vi.fn(),
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

    const word = screen.getByRole("textbox", { name: "英文單字" });
    fireEvent.click(screen.getByRole("button", { name: "建立" }));

    await waitFor(() => expect(word).toHaveFocus());
    expect(word).toHaveAttribute("aria-invalid", "true");
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
    expect(screen.getByRole("alert", { name: "" })).toHaveTextContent(
      "已帶你到第一個需要補齊的位置",
    );
  });
});

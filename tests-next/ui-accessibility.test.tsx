import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EmptyState, ErrorState } from "@/components/ui/page-state";
import { useState } from "react";
import { ListChoiceGroup, ListNavRow } from "@/components/ui/list";

afterEach(cleanup);

describe("shared accessible states", () => {
  it("moves a single selection with arrow keys and skips disabled options", async () => {
    function Choices() {
      const [value, setValue] = useState("first");
      return <ListChoiceGroup label="練習方式" value={value} onSelect={setValue}
        options={[
          { id: "first", label: "單字卡" },
          { id: "second", label: "停用", disabled: true },
          { id: "third", label: "拼字" },
        ]} />;
    }
    render(<Choices />);
    const first = screen.getByRole("radio", { name: "單字卡" });
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowDown" });
    await waitFor(() => expect(screen.getByRole("radio", { name: "拼字" })).toHaveFocus());
    expect(screen.getByRole("radio", { name: "拼字" })).toHaveAttribute("aria-checked", "true");
    expect(first).toHaveAttribute("aria-checked", "false");
  });

  it("keeps empty-state instructions outside the decorative entry", () => {
    render(<EmptyState title="尚無單字" description="先建立單字集" headword="hello" />);
    const description = screen.getByText("先建立單字集");
    expect(description.closest('[aria-hidden="true"]')).toBeNull();
  });

  it("announces errors and offers a working retry", () => {
    const retry = vi.fn();
    render(<ErrorState error="讀取中斷" onRetry={retry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("讀取中斷");
    fireEvent.click(screen.getByRole("button"));
    expect(retry).toHaveBeenCalledOnce();
  });

  it("does not leave a disabled destination keyboard-navigable", () => {
    render(<ListNavRow disabled href="/library" label="單字" />);
    expect(screen.getByRole("link")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("link")).not.toHaveAttribute("href");
    expect(screen.getByRole("link").tabIndex).toBe(-1);
  });
});

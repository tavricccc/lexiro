import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EmptyState, ErrorState } from "@/components/ui/page-state";
import { useState, type FormEvent } from "react";
import { ListChoiceGroup, ListNavRow } from "@/components/ui/list";
import { StepActions } from "@/components/ui/step-actions";
import { AiRunPanel } from "@/components/ai/ai-run-panel";
import type { AiRunState } from "@/components/ai/use-ai-generation";

const account = vi.hoisted(() => ({ admin: true }));
vi.mock("@/components/ai/use-managed-account", () => ({
  useManagedAccount: () => ({ data: { admin: account.admin } }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  account.admin = true;
});

describe("shared accessible states", () => {
  it("shows failed source and reply only to administrators while keeping valid results available", () => {
    const state: AiRunState<string> = {
      status: "error",
      phase: "validating",
      characters: 0,
      completed: 99,
      total: 104,
      segments: 1,
      error: "formula：答案與目標單字不符",
      items: ["已完成的題目"],
      notices: [],
      startedAt: null,
      elapsedMs: 32000,
      remaining: 1,
      usage: {},
      diagnostic: {
        request: JSON.stringify({ sources: [{ word: "formula" }] }),
        response: JSON.stringify({ items: [{ sentence: "The method works.", answer: "method" }] }),
        responseId: "resp_test",
      },
    };
    const review = vi.fn();
    const props = {
      actionLabel: "產生題目",
      billableCount: 1,
      configured: true,
      kind: "vocabulary" as const,
      onCancel: vi.fn(),
      onResume: vi.fn(),
      onReview: review,
      onStart: vi.fn(),
      onTierChange: vi.fn(),
      ready: true,
      state,
      tier: "lite" as const,
      unit: "題",
    };
    render(<AiRunPanel {...props} />);
    expect(screen.getByText("管理員診斷資訊")).toBeInTheDocument();
    expect(screen.getByText(/The method works/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "查看已完成結果" }));
    expect(review).toHaveBeenCalledOnce();

    cleanup();
    account.admin = false;
    render(<AiRunPanel {...props} />);
    expect(screen.queryByText("管理員診斷資訊")).toBeNull();
    expect(screen.queryByText(/The method works/)).toBeNull();
    expect(screen.getByRole("button", { name: "查看已完成結果" })).toBeInTheDocument();
  });

  it("reserves the full height of a fixed action panel", () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      height: 224,
    } as DOMRect);
    const { container } = render(
      <StepActions>
        <button type="button">繼續</button>
        <button type="button">重試</button>
      </StepActions>,
    );
    expect(container.querySelector("[data-step-actions-space]")).toHaveStyle({
      minHeight: "224px",
    });
  });

  it("keeps a portaled submit action connected to its form", () => {
    const submit = vi.fn((event: FormEvent) => event.preventDefault());
    render(
      <form id="fixed-action-form" onSubmit={submit}>
        <StepActions>
          <button form="fixed-action-form" type="submit">儲存</button>
        </StepActions>
      </form>,
    );
    fireEvent.click(screen.getByRole("button", { name: "儲存" }));
    expect(submit).toHaveBeenCalledOnce();
  });

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
    render(<ListNavRow disabled href="/app/library" label="單字" />);
    expect(screen.getByRole("link")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("link")).not.toHaveAttribute("href");
    expect(screen.getByRole("link").tabIndex).toBe(-1);
  });
});

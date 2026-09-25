import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WordAssistant } from "@/components/library/word-assistant";
import type { AiGenerationSnapshot } from "@/components/ai/use-ai-generation";
import type { WordDraft } from "@/types";

vi.mock("@/stores/cloud-store", () => ({
  useCloudStore: (select: (state: { ready: boolean; user: { uid: string } }) => unknown) =>
    select({ ready: true, user: { uid: "fixture" } }),
}));

afterEach(cleanup);

const word: WordDraft = {
  word: "shift",
  senses: [{ id: "sense-1", pos: "n.", meaning: "輪班", examples: ["Night shift."], supplementary: false }],
};
const initialRun: AiGenerationSnapshot<WordDraft> = {
  tier: "lite",
  state: {
    status: "done",
    phase: "validating",
    characters: 0,
    completed: 1,
    total: 1,
    segments: 1,
    error: "",
    items: [word],
    notices: [],
    startedAt: null,
    elapsedMs: 50,
    remaining: 0,
    usage: {},
    diagnostic: null,
  },
};

describe("generated word review save", () => {
  it("keeps generated words and permits another save after a write failure", async () => {
    const onApply = vi.fn().mockRejectedValueOnce(new Error("儲存失敗")).mockResolvedValueOnce(undefined);
    render(
      <WordAssistant
        initialRun={initialRun}
        onApply={onApply}
        onPhase={vi.fn()}
        phase="review"
        sources="shift"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "加入單字集" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("儲存失敗"));
    expect(screen.getByText("shift")).toBeVisible();
    const retry = screen.getByRole("button", { name: "加入單字集" });
    expect(retry).toBeEnabled();
    fireEvent.click(retry);
    await waitFor(() => expect(onApply).toHaveBeenCalledTimes(2));
  });
});

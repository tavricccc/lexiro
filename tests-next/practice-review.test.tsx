import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReviewCard } from "@/components/practice/review-card";
import type { StudyWord } from "@/types";

const word: StudyWord = {
  id: "apple-sense", wordKey: "apple", word: "apple", pos: "n.",
  meaning: "蘋果", examples: [], example: "", supplementary: false,
};

afterEach(cleanup);

function Spelling({ onRate }: { onRate: ReturnType<typeof vi.fn> }) {
  const [revealed, setRevealed] = useState(false);
  return <ReviewCard item={word} task="spelling" typing revealed={revealed}
    busy={false} onReveal={() => setRevealed(true)} onRate={onRate} />;
}

describe("spelling feedback", () => {
  it("keeps a correct answer visible until the learner chooses a rating", async () => {
    const onRate = vi.fn();
    render(<Spelling onRate={onRate} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: " Apple " } });
    fireEvent.submit(screen.getByRole("textbox").closest("form")!);
    await waitFor(() => expect(screen.getByText("答對了")).toBeVisible());
    expect(screen.getByRole("heading", { name: "apple" })).toBeVisible();
    expect(onRate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "記得" }));
    expect(onRate).toHaveBeenCalledExactlyOnceWith("good");
  });

  it("reveals the correct spelling without recording a rating automatically", async () => {
    const onRate = vi.fn();
    render(<Spelling onRate={onRate} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "aple" } });
    fireEvent.submit(screen.getByRole("textbox").closest("form")!);
    await waitFor(() => expect(screen.getByText(/差一點，注意拼字/)).toBeVisible());
    expect(onRate).not.toHaveBeenCalled();
  });
});

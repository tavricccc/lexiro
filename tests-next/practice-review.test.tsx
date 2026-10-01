import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReviewCard } from "@/components/practice/review-card";
import type { StudyWord } from "@/types";

const word: StudyWord = {
  id: "apple-sense",
  wordKey: "apple",
  word: "apple",
  pos: "n.",
  meaning: "蘋果",
  examples: [],
  example: "",
  supplementary: false,
};

afterEach(cleanup);

function Spelling({ onRate }: { onRate: ReturnType<typeof vi.fn> }) {
  const [revealed, setRevealed] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  return (
    <ReviewCard
      item={word}
      revealed={revealed}
      last={false}
      selected={selected}
      onChecked={(correct) => setSelected(correct ? 0 : 1)}
      busy={false}
      onReveal={() => setRevealed(true)}
      onRate={onRate}
    />
  );
}

describe("spelling feedback", () => {
  it("keeps the judged answer visible and records it when advancing without a self-rating", async () => {
    const onRate = vi.fn();
    render(<Spelling onRate={onRate} />);
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: " Apple " },
    });
    fireEvent.submit(screen.getByRole("textbox").closest("form")!);
    await waitFor(() => expect(screen.getByText("答對了")).toBeVisible());
    expect(screen.getByText("apple")).toBeVisible();
    expect(onRate).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "記得" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "下一題" }));
    expect(onRate).toHaveBeenCalledExactlyOnceWith("good");
  });

  it("reveals the correct spelling without recording a rating automatically", async () => {
    const onRate = vi.fn();
    render(<Spelling onRate={onRate} />);
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "aple" },
    });
    fireEvent.submit(screen.getByRole("textbox").closest("form")!);
    await waitFor(() =>
      expect(screen.getByText(/差一點，注意拼字/)).toBeVisible(),
    );
    expect(onRate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "下一題" }));
    expect(onRate).toHaveBeenCalledExactlyOnceWith("again");
  });
});

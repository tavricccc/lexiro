import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  InputOrganizer,
  type OrganizerPhase,
} from "@/components/library/input-organizer";
const send = vi.hoisted(() => vi.fn());
vi.mock("@/stores/cloud-store", () => ({
  useCloudStore: (select: (value: { user: { uid: string } }) => unknown) =>
    select({ user: { uid: "user" } }),
}));
vi.mock("@/lib/managed-client", () => ({
  managedTurn: send,
  managedFetch: vi.fn(),
  readManagedStream: vi.fn(),
}));
afterEach(cleanup);

/** The page around the organizer owns which step is showing. */
function Host({ onConfirm }: { onConfirm: (text: string) => void }) {
  const [phase, setPhase] = useState<OrganizerPhase>("input");
  return (
    <InputOrganizer onConfirm={onConfirm} onPhase={setPhase} phase={phase} />
  );
}

describe("organize before generating", () => {
  it("moves to its own review step and passes the corrected list onward", async () => {
    send.mockResolvedValue({ text: '{"lines":["bank n. 銀行與河岸"]}' });
    const confirm = vi.fn();
    render(<Host onConfirm={confirm} />);
    fireEvent.change(screen.getByLabelText(/單字與提示/), {
      target: { value: "bank 銀行 河岸" },
    });
    fireEvent.click(screen.getByRole("button", { name: "整理輸入" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "確認清單，選擇生成檔位" }),
      ).toBeInTheDocument(),
    );
    // The step that produced the list is gone; only the list is being read.
    expect(screen.queryByLabelText(/單字與提示/)).toBeNull();
    expect(confirm).not.toHaveBeenCalled();
    const review = screen.getByDisplayValue("bank n. 銀行與河岸");
    fireEvent.change(review, { target: { value: "bank n. 河岸" } });
    fireEvent.click(
      screen.getByRole("button", { name: "確認清單，選擇生成檔位" }),
    );
    expect(confirm).toHaveBeenCalledWith("bank n. 河岸");
    expect(send.mock.calls[0][0].tier).toBe("lite");
    expect(send.mock.calls[0][1].kind).toBe("organizeText");
  });

  it("goes back to the input without losing what was organized", async () => {
    send.mockResolvedValue({ text: '{"lines":["bank n. 銀行"]}' });
    render(<Host onConfirm={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/單字與提示/), {
      target: { value: "bank 銀行" },
    });
    fireEvent.click(screen.getByRole("button", { name: "整理輸入" }));
    await waitFor(() =>
      expect(screen.getByDisplayValue("bank n. 銀行")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: "重新整理" }));
    expect(screen.getByLabelText(/單字與提示/)).toHaveValue("bank 銀行");
    fireEvent.click(screen.getByRole("button", { name: "查看結果" }));
    expect(screen.getByDisplayValue("bank n. 銀行")).toBeInTheDocument();
  });
});

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InputOrganizer } from "@/components/library/input-organizer";
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
describe("organize before generating", () => {
  it("requires confirmation and passes the user's corrected list onward", async () => {
    send.mockResolvedValue({ text: '{"lines":["bank n. 銀行與河岸"]}' });
    const confirm = vi.fn(),
      invalidate = vi.fn();
    render(
      <InputOrganizer
        disabled={false}
        onConfirm={confirm}
        onInvalidate={invalidate}
      />,
    );
    fireEvent.change(screen.getByLabelText(/單字與提示/), {
      target: { value: "bank 銀行 河岸" },
    });
    fireEvent.click(screen.getByRole("button", { name: "整理輸入" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "確認清單，選擇生成檔位" }),
      ).toBeInTheDocument(),
    );
    expect(confirm).not.toHaveBeenCalled();
    const review = screen.getByDisplayValue("bank n. 銀行與河岸");
    fireEvent.change(review, { target: { value: "bank n. 河岸" } });
    fireEvent.click(
      screen.getByRole("button", { name: "確認清單，選擇生成檔位" }),
    );
    expect(confirm).toHaveBeenCalledWith("bank n. 河岸");
    expect(invalidate).toHaveBeenCalled();
    expect(send.mock.calls[0][0].tier).toBe("lite");
    expect(send.mock.calls[0][1].kind).toBe("organizeText");
  });
});

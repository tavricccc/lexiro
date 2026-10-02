import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AiRequestError } from "@/src/lib/ai/errors";

const account = {
  version: 0,
  uid: "u",
  email: "someone@example.test",
  points: 120,
  monthly: 0,
  renews_at: 0,
  note: null,
};
const sent: unknown[] = [];
let returnedAccount = account;
let patchError: Error | null = null;
const { success } = vi.hoisted(() => ({ success: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success, error: vi.fn() } }));
vi.mock("@/lib/managed-client", () => ({
  managedJson: (_path: string, init?: RequestInit) => {
    if (init?.method === "PATCH") {
      sent.push(JSON.parse(String(init.body)));
      if (patchError) return Promise.reject(patchError);
    }
    return Promise.resolve(returnedAccount);
  },
  notifyManagedAccountChanged: () => undefined,
}));

const { AdminAccountEditor } = await import("@/components/me/admin-accounts");

async function open() {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <AdminAccountEditor accountUid="u" />
    </QueryClientProvider>,
  );
  // Two number fields on this screen: the amount to move, then the allowance.
  const [amount] = await screen.findAllByRole("spinbutton");
  return amount;
}

const balance = () =>
  screen.getByText("調整後餘額").parentElement?.parentElement?.textContent;

beforeEach(() => {
  localStorage.clear();
  returnedAccount = account;
  patchError = null;
  sent.length = 0;
  success.mockClear();
});
afterEach(cleanup);

describe("adjusting an account's points", () => {
  it("offers to resume an interrupted adjustment", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const first = render(
      <QueryClientProvider client={client}>
        <AdminAccountEditor accountUid="u" />
      </QueryClientProvider>,
    );
    const [amount] = await screen.findAllByRole("spinbutton");
    fireEvent.change(amount, { target: { value: "42" } });
    first.unmount();

    render(
      <QueryClientProvider client={client}>
        <AdminAccountEditor accountUid="u" />
      </QueryClientProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "接續上次" }));
    expect(screen.getAllByRole("spinbutton")[0]).toHaveValue(42);
  });

  it("takes points away, which a signed number field on a keypad could not", async () => {
    const amount = await open();
    fireEvent.click(screen.getByText("扣除點數"));
    fireEvent.change(amount, { target: { value: "50" } });
    expect(balance()).toContain("70");
  });

  it("previews the floor rather than promising a negative balance", async () => {
    const amount = await open();
    fireEvent.click(screen.getByText("扣除點數"));
    fireEvent.change(amount, { target: { value: "500" } });
    expect(balance()).toContain("0");
    expect(balance()).not.toContain("-");
  });

  it("previews the allowance landing at once, because that is what happens", async () => {
    await open();
    const allowance = screen.getAllByRole("spinbutton")[1];
    fireEvent.change(allowance, { target: { value: "1000" } });
    expect(balance()).toContain("1000");
  });

  it("sends the direction as the sign, so the form stays unsigned", async () => {
    const amount = await open();
    sent.length = 0;
    fireEvent.click(screen.getByText("扣除點數"));
    fireEvent.change(amount, { target: { value: "30" } });
    fireEvent.click(screen.getByText("儲存調整"));
    expect(sent).toEqual([]);
    expect(screen.getByRole("dialog")).toHaveTextContent("扣除 30 點");
    fireEvent.click(screen.getByRole("button", { name: "確認並儲存" }));
    expect(sent).toEqual([
      {
        addPoints: -30,
        expected: {
          version: 0,
          points: 120,
          monthly: 0,
          renews_at: 0,
          note: null,
        },
      },
    ]);
  });
  it("uses the stored response for completion feedback instead of the old balance preview", async () => {
    const amount = await open();
    fireEvent.change(amount, { target: { value: "30" } });
    returnedAccount = { ...account, points: 543 };
    fireEvent.click(screen.getByText("儲存調整"));
    fireEvent.click(screen.getByRole("button", { name: "確認並儲存" }));
    await waitFor(() =>
      expect(success).toHaveBeenCalledWith("已儲存，餘額 543 點"),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("sends only a changed note, without overwriting the allowance or adding zero points", async () => {
    await open();
    fireEvent.change(screen.getByRole("textbox", { name: "備註" }), {
      target: { value: "Updated note" },
    });
    fireEvent.click(screen.getByText("儲存調整"));
    expect(sent).toEqual([
      {
        note: "Updated note",
        expected: {
          version: 0,
          points: 120,
          monthly: 0,
          renews_at: 0,
          note: null,
        },
      },
    ]);
    await waitFor(() => expect(success).toHaveBeenCalledOnce());
  });
  it("offers a fresh account read after conflict and never repeats the financial write to reload it", async () => {
    const amount = await open();
    fireEvent.change(amount, { target: { value: "30" } });
    patchError = new AiRequestError("帳號資料已變動", {
      code: "stale_account",
      status: 409,
      retryable: false,
    });
    fireEvent.click(screen.getByText("儲存調整"));
    fireEvent.click(screen.getByRole("button", { name: "確認並儲存" }));
    await within(screen.getByRole("dialog")).findByRole("alert");
    returnedAccount = { ...account, points: 500 };
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "重新載入帳號",
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(sent).toHaveLength(1);
    expect(success).not.toHaveBeenCalled();
    expect(screen.getAllByText("500")[0]).toBeVisible();
  });
});

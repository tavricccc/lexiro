import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const account = {
  uid: "u",
  email: "someone@example.test",
  points: 120,
  monthly: 0,
  renews_at: 0,
  note: null,
};
const sent: unknown[] = [];
vi.mock("@/lib/managed-client", () => ({
  managedJson: (_path: string, init?: RequestInit) => {
    if (init?.method === "PATCH") sent.push(JSON.parse(String(init.body)));
    return Promise.resolve(account);
  },
  notifyManagedAccountChanged: () => undefined,
}));

const { AdminAccountEditor } = await import("@/components/me/admin-accounts");

async function open() {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
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

afterEach(cleanup);

describe("adjusting an account's points", () => {
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
    expect(sent).toEqual([{ addPoints: -30, monthly: 0, note: "" }]);
  });
});

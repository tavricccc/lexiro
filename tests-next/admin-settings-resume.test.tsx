import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdminSettings } from "@/components/me/admin-settings";

const settings = { freeTrial: false, defaultInitial: 10, defaultMonthly: 20 };
vi.mock("@/lib/managed-client", () => ({
  managedJson: () => Promise.resolve(settings),
}));

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe("admin settings draft", () => {
  it("survives navigation and an unchanged background refresh", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const view = render(
      <QueryClientProvider client={client}>
        <AdminSettings />
      </QueryClientProvider>,
    );
    const [initial] = await screen.findAllByRole("spinbutton");
    fireEvent.change(initial, { target: { value: "" } });
    expect((initial as HTMLInputElement).value).toBe("");
    fireEvent.change(initial, { target: { value: "35" } });
    expect(initial).toHaveValue(35);

    client.setQueryData(["admin-settings", undefined], { ...settings });
    expect(screen.getAllByRole("spinbutton")[0]).toHaveValue(35);
    view.unmount();

    render(
      <QueryClientProvider client={client}>
        <AdminSettings />
      </QueryClientProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "接續上次" }));
    await waitFor(() =>
      expect(screen.getAllByRole("spinbutton")[0]).toHaveValue(35),
    );
  });
});

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
import { AiRequestError } from "@/src/lib/ai/errors";

const settings = {
  version: 0,
  freeTrial: false,
  defaultInitial: 10,
  defaultMonthly: 20,
};
const sent: unknown[] = [];
let returnedSettings = settings;
let patchError: Error | null = null;
vi.mock("@/lib/managed-client", () => ({
  managedJson: (_path: string, init?: RequestInit) => {
    if (init?.method === "PATCH") {
      sent.push(JSON.parse(String(init.body)));
      if (patchError) return Promise.reject(patchError);
    }
    return Promise.resolve(returnedSettings);
  },
}));

beforeEach(() => {
  localStorage.clear();
  sent.length = 0;
  returnedSettings = settings;
  patchError = null;
});
afterEach(cleanup);

describe("admin settings draft", () => {
  it("reloads a conflicted settings snapshot without submitting another change", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AdminSettings />
      </QueryClientProvider>,
    );
    const [initial] = await screen.findAllByRole("spinbutton");
    fireEvent.change(initial, { target: { value: "35" } });
    patchError = new AiRequestError("管理設定已變動", {
      retryable: false,
      status: 409,
      code: "stale_settings",
    });
    fireEvent.click(screen.getByRole("button", { name: "儲存設定" }));
    await screen.findByRole("alert");
    returnedSettings = { ...settings, defaultInitial: 77, defaultMonthly: 88 };
    fireEvent.click(screen.getByRole("button", { name: "重新載入設定" }));
    await waitFor(() =>
      expect(screen.getAllByRole("spinbutton")[0]).toHaveValue(77),
    );
    expect(screen.getAllByRole("spinbutton")[1]).toHaveValue(88);
    expect(sent).toHaveLength(1);
  });
  it("patches only the setting that changed and uses the returned full settings", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AdminSettings />
      </QueryClientProvider>,
    );
    const [initial] = await screen.findAllByRole("spinbutton");
    fireEvent.change(initial, { target: { value: "35" } });
    fireEvent.click(screen.getByRole("button", { name: "儲存設定" }));
    expect(sent).toEqual([{ defaultInitial: 35, expected: settings }]);
    await waitFor(() =>
      expect(screen.getAllByRole("spinbutton")[0]).toHaveValue(10),
    );
  });
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

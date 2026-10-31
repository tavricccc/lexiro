import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import type { User } from "firebase/auth";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdminEntry } from "@/components/me/admin-entry";
import { AdminPage } from "@/components/me/admin-page";
import { useCloudStore } from "@/stores/cloud-store";
import { render } from "./render";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@/lib/agent-client", () => ({ agentJson: request }));

const initial = useCloudStore.getState();
const overview = {
  day: "2026-10-31",
  accounts: 12,
  activeToday: 3,
  writesToday: 1500,
  readsToday: 40000,
  storedBytes: 5 * 1024 * 1024,
  agentPaused: false,
  disabled: [{ uid: "bad1", reason: "abuse", disabledAt: 1 }],
  top: [
    {
      uid: "busy1",
      writesToday: 900,
      storedBytes: 2048,
      readsToday: 70,
      disabled: false,
    },
  ],
};

beforeEach(() => {
  request.mockReset();
  useCloudStore.setState({ user: { uid: "me" } as User, ready: true });
});
afterEach(() => {
  cleanup();
  useCloudStore.setState(initial);
});

describe("administrator entry", () => {
  it("shows the way in only when the Worker says the account is an administrator", async () => {
    request.mockResolvedValue({ admin: true });
    render(<AdminEntry />);
    expect(await screen.findByText("管理員")).toBeVisible();
  });

  it("draws nothing for an ordinary account", async () => {
    request.mockResolvedValue({ admin: false });
    render(<AdminEntry />);
    await waitFor(() => expect(request).toHaveBeenCalledWith("/admin/status"));
    expect(screen.queryByText("管理員")).toBeNull();
  });
});

describe("administrator page", () => {
  it("shows account count, usage and the busiest accounts", async () => {
    request.mockResolvedValue(overview);
    render(<AdminPage />);
    expect(await screen.findByText("busy1")).toBeVisible();
    expect(screen.getByText("12")).toBeVisible();
    expect(screen.getByText("1,500")).toBeVisible();
    expect(screen.getByText("5.0 MB")).toBeVisible();
  });

  it("disables an account after confirmation and reloads the overview", async () => {
    request.mockResolvedValue(overview);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<AdminPage />);
    await screen.findByText("busy1");
    fireEvent.click(screen.getAllByRole("button", { name: "停用" })[0]);
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith("/admin/accounts/busy1/disabled", {
        method: "PUT",
        body: JSON.stringify({ reason: "" }),
      }),
    );
  });

  it("does not disable when the confirmation is declined", async () => {
    request.mockResolvedValue(overview);
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<AdminPage />);
    await screen.findByText("busy1");
    fireEvent.click(screen.getAllByRole("button", { name: "停用" })[0]);
    expect(request).not.toHaveBeenCalledWith(
      "/admin/accounts/busy1/disabled",
      expect.anything(),
    );
  });

  it("enables a disabled account", async () => {
    request.mockResolvedValue(overview);
    render(<AdminPage />);
    await screen.findByText("bad1");
    fireEvent.click(screen.getByRole("button", { name: "解除停用" }));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith("/admin/accounts/bad1/disabled", {
        method: "DELETE",
      }),
    );
  });

  it("tells a non-administrator no", async () => {
    request.mockRejectedValue(new Error("這個帳號不是管理員。"));
    render(<AdminPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("不是管理員");
  });
});

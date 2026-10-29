import {
  act,
  cleanup,
  fireEvent,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "firebase/auth";
import { AdminBanner } from "@/components/admin/admin-banner";
import { AdminAccountPage } from "@/components/admin/admin-account-page";
import { alertText, type ServiceStatus } from "@/lib/admin-client";
import { AgentRequestError } from "@/lib/agent-client";
import { useAdminStore } from "@/stores/admin-store";
import { useCloudStore } from "@/stores/cloud-store";
import { render } from "./render";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@/lib/agent-client", async (original) => ({
  ...(await original<typeof import("@/lib/agent-client")>()),
  agentJson: request,
}));

const cloud = useCloudStore.getState();
const admin = useAdminStore.getState();
const STATUS: ServiceStatus = {
  usage: null,
  agentPaused: null,
  alerts: [
    { code: "quota_high", quota: "d1RowsRead", share: 0.72 },
    { code: "agent_paused", manual: true, since: 1 },
  ],
};
const notAdmin = () => new AgentRequestError("refused", "not_admin");

beforeEach(() => {
  request.mockReset();
  useCloudStore.setState({ user: { uid: "u1" } as User, ready: true });
});
afterEach(() => {
  cleanup();
  useCloudStore.setState(cloud);
  useAdminStore.setState(admin, true);
});

describe("admin status", () => {
  it("marks an account the Worker answers for as an admin and keeps its status", async () => {
    request.mockResolvedValueOnce(STATUS);
    await useAdminStore.getState().refresh("u1");
    expect(useAdminStore.getState()).toMatchObject({
      uid: "u1",
      admin: true,
      status: STATUS,
    });
    expect(request).toHaveBeenCalledWith("/admin/status", {
      signal: undefined,
    });
  });

  it("asks about a non-admin only once per account", async () => {
    request.mockRejectedValue(notAdmin());
    await useAdminStore.getState().refresh("u1");
    await useAdminStore.getState().refresh("u1");
    expect(useAdminStore.getState().admin).toBe(false);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("asks again after a failure that said nothing about the account", async () => {
    request
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(STATUS);
    await useAdminStore.getState().refresh("u1");
    await useAdminStore.getState().refresh("u1");
    expect(useAdminStore.getState().admin).toBe(true);
  });

  it("forgets the answer when another account signs in", async () => {
    request.mockResolvedValueOnce(STATUS).mockRejectedValueOnce(notAdmin());
    await useAdminStore.getState().refresh("u1");
    await useAdminStore.getState().refresh("u2");
    expect(useAdminStore.getState()).toMatchObject({
      uid: "u2",
      admin: false,
      status: null,
    });
  });
});

describe("admin alerts", () => {
  it("names the quota and the share it reached", () => {
    expect(alertText(STATUS.alerts[0])).toBe(
      "D1 讀取列數已用掉 72%，免費額度快見底了。",
    );
  });

  it("tells a check that never ran from one that stopped", () => {
    expect(alertText({ code: "usage_check_stale", checkedAt: null })).toContain(
      "從來沒跑過",
    );
    expect(alertText({ code: "usage_check_stale", checkedAt: 1 })).toContain(
      "超過兩小時",
    );
  });
});

describe("admin banner", () => {
  it("shows an admin the first alert and how many more wait", async () => {
    request.mockResolvedValueOnce(STATUS);
    render(<AdminBanner />);
    const banner = await screen.findByRole("alert");
    expect(banner).toHaveTextContent("D1 讀取列數已用掉 72%");
    expect(banner).toHaveTextContent("另有 1 則");
  });

  it("shows nothing to an account that is not an admin", async () => {
    request.mockRejectedValueOnce(notAdmin());
    render(<AdminBanner />);
    await waitFor(() =>
      expect(useAdminStore.getState().checkedAt).toBeGreaterThan(0),
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("admin account page", () => {
  const account = {
    uid: "target1",
    email: "ann@x.io",
    seenDay: "2026-10-29",
    writesToday: 3,
    readsToday: 40,
    storedBytes: 2048,
    disabled: null,
    unlimited: false,
    revision: 7,
    sets: 1,
    words: 20,
    questions: 5,
    shares: 0,
    activeLinks: 0,
    connections: [],
    actions: [],
  };
  beforeEach(() => {
    useAdminStore.setState({
      uid: "u1",
      admin: true,
      status: STATUS,
      checkedAt: Date.now(),
    });
  });

  it("asks for a reason before it lets an admin disable an account", async () => {
    request.mockResolvedValueOnce(account);
    render(<AdminAccountPage uid="target1" />);
    const disable = await screen.findByRole("button", { name: "停用帳號" });
    expect(disable).toBeDisabled();
    fireEvent.change(screen.getByLabelText("停用理由"), {
      target: { value: "spam" },
    });
    expect(disable).toBeEnabled();
  });

  it("sends the reason with the disable and shows the account as disabled", async () => {
    request.mockResolvedValueOnce(account).mockResolvedValueOnce({
      ...account,
      disabled: { reason: "spam", at: 1 },
    });
    render(<AdminAccountPage uid="target1" />);
    fireEvent.change(await screen.findByLabelText("停用理由"), {
      target: { value: " spam " },
    });
    fireEvent.click(screen.getByRole("button", { name: "停用帳號" }));
    const dialog = await screen.findByRole("dialog");
    await act(async () => {
      fireEvent.click(
        Array.from(dialog.querySelectorAll("button")).find(
          (button) => button.textContent === "停用帳號",
        )!,
      );
    });
    expect(request).toHaveBeenLastCalledWith(
      "/admin/accounts/target1/actions",
      {
        method: "POST",
        body: JSON.stringify({ action: "disable", reason: "spam" }),
      },
    );
    expect(await screen.findByText("已停用：spam")).toBeVisible();
  });

  it("offers no disable on the admin's own account", async () => {
    request.mockResolvedValueOnce({ ...account, uid: "u1" });
    render(<AdminAccountPage uid="u1" />);
    await screen.findByText("撤銷所有連線");
    expect(screen.queryByRole("button", { name: "停用帳號" })).toBeNull();
  });
});

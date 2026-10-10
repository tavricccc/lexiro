import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "firebase/auth";
import { AgentAccessDialog } from "@/components/agent/access-dialog";
import { AgentOAuthConsent } from "@/components/agent/oauth-consent";
import { useCloudStore } from "@/stores/cloud-store";
const { generate, request } = vi.hoisted(() => ({
  generate: vi.fn(),
  request: vi.fn(),
}));
vi.mock("@/lib/agent-client", () => ({
  generateAgentLink: generate,
  agentJson: request,
}));
const initial = useCloudStore.getState();
const link = {
  id: "link-local",
  setId: "set-local",
  url: "http://localhost/access/local?token=synthetic",
  expiresAt: Date.now() + 7200000,
  revokedAt: null,
};
beforeEach(() => {
  generate.mockReset();
  request.mockReset();
  useCloudStore.setState({ user: { uid: "local-user" } as User, ready: true });
});
afterEach(() => {
  cleanup();
  useCloudStore.setState(initial);
});
describe("agent URL workflow", () => {
  it("initializes sign-in on the public OAuth route before loading consent", async () => {
    const initialize = vi.fn(async () => {
      useCloudStore.setState({
        ready: true,
        user: { uid: "local-user", email: "local@example.test" } as User,
      });
    });
    useCloudStore.setState({ ready: false, user: null, initialize });
    request
      .mockResolvedValueOnce({
        clientName: "Local Agent",
        redirectHost: "localhost:4200",
        scopes: ["sets:read", "sets:write"],
      })
      .mockRejectedValueOnce(new Error("授權已過期"));
    render(<AgentOAuthConsent requestId="local-request" />);
    expect(await screen.findByText("Local Agent")).toBeVisible();
    expect(initialize).toHaveBeenCalledTimes(1);
    expect(screen.getByText("local@example.test")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "允許連線" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("授權已過期");
    expect(request).toHaveBeenLastCalledWith("/oauth/approve/local-request", {
      method: "POST",
      body: JSON.stringify({ allow: true }),
    });
  });
  it("does not create a set before sign-in", () => {
    useCloudStore.setState({ user: null });
    const createSet = vi.fn();
    render(
      <AgentAccessDialog open onOpenChange={vi.fn()} createSet={createSet} />,
    );
    expect(screen.getByRole("button", { name: "登入 Lexiro" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "產生授權 URL" })).toBeNull();
    expect(createSet).not.toHaveBeenCalled();
  });
  it("keeps the newly created set across a sync failure and uses two hours by default", async () => {
    const createSet = vi.fn().mockResolvedValue("set-local");
    generate
      .mockRejectedValueOnce(new Error("同步尚未完成"))
      .mockResolvedValueOnce(link);
    render(
      <AgentAccessDialog open onOpenChange={vi.fn()} createSet={createSet} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "產生授權 URL" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("同步尚未完成");
    fireEvent.click(screen.getByRole("button", { name: "產生授權 URL" }));
    expect(
      await screen.findByRole("textbox", { name: "授權連結" }),
    ).toHaveValue(link.url);
    expect(createSet).toHaveBeenCalledTimes(1);
    expect(generate).toHaveBeenLastCalledWith("set-local", 7200);
    expect(screen.getByText(/也可以刪除整個單字集/)).toBeVisible();
    request.mockResolvedValueOnce({ revoked: true });
    fireEvent.click(screen.getByRole("button", { name: "撤銷連結" }));
    await waitFor(() =>
      expect(screen.queryByRole("textbox", { name: "授權連結" })).toBeNull(),
    );
    expect(request).toHaveBeenCalledWith("/links/link-local", {
      method: "DELETE",
    });
  });
});

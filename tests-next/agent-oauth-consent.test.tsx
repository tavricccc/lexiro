import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "firebase/auth";
import { AgentOAuthConsent } from "@/components/agent/oauth-consent";
import { useCloudStore } from "@/stores/cloud-store";
const { request } = vi.hoisted(() => ({
  request: vi.fn(),
}));
vi.mock("@/lib/agent-client", () => ({
  agentJson: request,
}));
const initial = useCloudStore.getState();
beforeEach(() => {
  request.mockReset();
  useCloudStore.setState({ user: { uid: "local-user" } as User, ready: true });
});
afterEach(() => {
  cleanup();
  useCloudStore.setState(initial);
});
describe("agent OAuth consent", () => {
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
});

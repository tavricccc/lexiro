import { beforeEach, describe, expect, it, vi } from "vitest";

const popup = vi.fn();
const redirect = vi.fn();
vi.mock("firebase/auth", async (original) => ({
  ...(await original<typeof import("firebase/auth")>()),
  signInWithPopup: popup,
  signInWithRedirect: redirect,
}));

const { popupOrRedirect } = await import("@/data/auth");
const auth = {} as never;
const provider = {} as never;
const closing = Object.assign(new Error("The database connection is closing."), { name: "InvalidStateError" });

describe("popupOrRedirect", () => {
  beforeEach(() => {
    popup.mockReset();
    redirect.mockReset().mockResolvedValue(undefined);
  });

  it("retries the popup once when Safari closed the database", async () => {
    popup.mockRejectedValueOnce(closing).mockResolvedValueOnce({ user: "u" });
    expect(await popupOrRedirect(auth, provider)).toEqual({ user: "u" });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("redirects when the database keeps closing", async () => {
    popup.mockRejectedValue(closing);
    expect(await popupOrRedirect(auth, provider)).toBeNull();
    expect(redirect).toHaveBeenCalledOnce();
  });

  it("redirects a blocked popup after saving pending state", async () => {
    popup.mockRejectedValue({ code: "auth/popup-blocked" });
    const save = vi.fn();
    expect(await popupOrRedirect(auth, provider, save)).toBeNull();
    expect(save).toHaveBeenCalledOnce();
    expect(redirect).toHaveBeenCalledOnce();
  });

  it("passes a cancelled popup through without redirecting", async () => {
    popup.mockRejectedValue({ code: "auth/popup-closed-by-user" });
    await expect(popupOrRedirect(auth, provider)).rejects.toEqual({ code: "auth/popup-closed-by-user" });
    expect(redirect).not.toHaveBeenCalled();
  });
});

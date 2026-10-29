import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  popup: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock("firebase/auth", () => ({
  GoogleAuthProvider: class {},
  signInWithPopup: mocks.popup,
  signInWithRedirect: mocks.redirect,
}));
vi.mock("@/src/lib/firebase", () => ({
  configureFirebaseAuth: async () => ({}),
}));

import { useCloudStore } from "@/stores/cloud-store";

const failWith = (code: string) =>
  mocks.popup.mockRejectedValue(Object.assign(new Error(code), { code }));

describe("signIn", () => {
  beforeEach(() => {
    mocks.popup.mockReset();
    mocks.redirect.mockReset();
  });

  it("uses the popup when it opens", async () => {
    mocks.popup.mockResolvedValue({});
    await useCloudStore.getState().signIn();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it.each([
    "auth/popup-blocked",
    "auth/operation-not-supported-in-this-environment",
  ])("redirects when the popup fails with %s", async (code) => {
    failWith(code);
    await useCloudStore.getState().signIn();
    expect(mocks.redirect).toHaveBeenCalledTimes(1);
  });

  it("keeps a closed popup as an error", async () => {
    failWith("auth/popup-closed-by-user");
    await expect(useCloudStore.getState().signIn()).rejects.toThrow();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});

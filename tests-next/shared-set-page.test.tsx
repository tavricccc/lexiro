import type { User } from "firebase/auth";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SharedSetPage } from "@/components/library/shared-set-page";
import { buildSenseId, buildSetWordKey } from "@/src/lib/library";
import { emptyLibraryState } from "@/src/lib/library-repository";
import { useCloudStore } from "@/stores/cloud-store";
import { useLibraryStore } from "@/stores/library-store";

const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  copy: vi.fn(),
  push: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/lib/share-client", () => ({ readSharedSet: mocks.read }));
vi.mock("@/src/lib/set-share", () => ({ copySharedSet: mocks.copy }));

const timestamp = "2026-10-11T00:00:00.000Z";
const wordKey = buildSetWordKey("their-set", "harbor");
const senseId = buildSenseId(wordKey, "n.", "港口");
const sharedSet = {
  id: "their-set",
  setName: "Travel",
  folderId: "",
  createdAt: timestamp,
  updatedAt: timestamp,
  words: [
    {
      wordKey,
      word: "harbor",
      senses: [
        {
          id: senseId,
          pos: "n.",
          meaningZh: "港口",
          examples: [],
          supplementary: false,
        },
      ],
      updatedAt: timestamp,
    },
  ],
  memberships: [{ wordKey, senseIds: [senseId] }],
  questions: [],
};

beforeEach(() => {
  mocks.read.mockReset();
  mocks.copy.mockReset();
  mocks.push.mockReset();
  const library = emptyLibraryState();
  library.sets = [{ ...sharedSet, id: "mine", words: undefined } as never];
  useLibraryStore.setState({ state: library, status: "ready" });
  useCloudStore.setState({
    ready: true,
    configured: true,
    user: { uid: "reader" } as User,
  });
});
afterEach(cleanup);

describe("shared set page", () => {
  it("asks for an account before reading anything", () => {
    useCloudStore.setState({ user: null });
    render(<SharedSetPage shareId="abc" />);
    expect(screen.getByText("登入後才能查看別人分享的單字集。")).toBeVisible();
    expect(mocks.read).not.toHaveBeenCalled();
  });

  it("previews the owner's set and saves a renamed copy into the reader's library", async () => {
    mocks.read.mockResolvedValue({ id: "abc", own: false, set: sharedSet });
    mocks.copy.mockResolvedValue({ id: "copied", setName: "Travel 2" });
    render(<SharedSetPage shareId="abc" />);
    expect(await screen.findByText("harbor")).toBeVisible();
    expect(screen.getByText("n. 港口")).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "存一份副本到我的題庫" }),
    );
    await vi.waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith("/app/sets/copied"),
    );
    expect(mocks.copy).toHaveBeenCalledWith(
      sharedSet,
      { setName: expect.not.stringMatching(/^Travel$/) },
      expect.anything(),
    );
  });

  it("points the owner at their own set instead of offering a copy", async () => {
    mocks.read.mockResolvedValue({ id: "abc", own: true, set: sharedSet });
    render(<SharedSetPage shareId="abc" />);
    expect(
      await screen.findByRole("link", { name: "打開單字集" }),
    ).toHaveAttribute("href", "/app/sets/their-set");
    expect(
      screen.queryByRole("button", { name: "存一份副本到我的題庫" }),
    ).toBeNull();
  });

  it("explains a link that no longer works", async () => {
    mocks.read.mockRejectedValue(
      new Error("這個分享連結已失效，或單字集已被刪除。"),
    );
    render(<SharedSetPage shareId="abc" />);
    expect(
      await screen.findByText("這個分享連結已失效，或單字集已被刪除。"),
    ).toBeVisible();
  });
});

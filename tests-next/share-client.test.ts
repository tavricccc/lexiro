import { describe, expect, it, vi } from "vitest";

import { buildSenseId, buildSetWordKey } from "@/src/lib/library";

const { agentJson } = vi.hoisted(() => ({ agentJson: vi.fn() }));
vi.mock("@/lib/agent-client", () => ({ agentJson }));
const { readSharedSet } = await import("@/lib/share-client");

const timestamp = "2026-10-11T00:00:00.000Z";
const wordKey = buildSetWordKey("their-set", "harbor");
const senseId = buildSenseId(wordKey, "n.", "港口");

describe("readSharedSet", () => {
  it("validates the owner's cloud snapshot like an imported share file", async () => {
    const set = {
      id: "their-set",
      setName: "Travel",
      folderId: "__uncategorized__",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const words = [
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
    ];
    agentJson.mockResolvedValue({
      id: "abc",
      own: false,
      snapshot: {
        set,
        words,
        memberships: [{ wordKey, senseIds: [senseId] }],
        questions: [],
      },
    });
    const view = await readSharedSet("abc");
    expect(agentJson).toHaveBeenCalledWith("/shares/abc", {
      signal: undefined,
    });
    expect(view).toMatchObject({
      id: "abc",
      own: false,
      set: { ...set, words },
    });

    agentJson.mockResolvedValue({
      id: "abc",
      own: false,
      snapshot: {
        set: { ...set, extra: 1 },
        words,
        memberships: [],
        questions: [],
      },
    });
    await expect(readSharedSet("abc")).rejects.toThrow();
  });
});

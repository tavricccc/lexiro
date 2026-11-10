import { describe, expect, it, vi } from "vitest";
import { emptyLibraryState } from "@/src/lib/library-repository";
import { buildSenseId, buildSetWordKey } from "@/src/lib/library";
import { normalizeLibraryState } from "@/src/lib/share";
import { copySharedSet, createSetSharePayload } from "@/src/lib/set-share";
function library() {
  const state = emptyLibraryState();
  const wordKey = buildSetWordKey("set", "wander");
  const senseId = buildSenseId(wordKey, "v.", "漫遊");
  const date = "2026-11-11T00:00:00Z";
  state.sets = [
    {
      id: "set",
      setName: "旅行",
      folderId: "__uncategorized__",
      hue: "violet",
      icon: "airplane-tilt",
      createdAt: date,
      updatedAt: date,
    },
  ];
  state.words[wordKey] = {
    wordKey,
    word: "wander",
    senses: [
      {
        id: senseId,
        pos: "v.",
        meaningZh: "漫遊",
        examples: [],
        supplementary: false,
      },
    ],
    updatedAt: date,
  };
  state.memberships.set = [{ wordKey, senseIds: [senseId] }];
  return state;
}
describe("set appearance compatibility", () => {
  it("preserves appearance through stored library normalization", () => {
    expect(normalizeLibraryState(library()).sets[0]).toMatchObject({
      hue: "violet",
      icon: "airplane-tilt",
    });
  });
  it("reads sets saved before appearance fields existed", () => {
    const state = library();
    delete state.sets[0].hue;
    delete state.sets[0].icon;
    expect(normalizeLibraryState(state).sets[0].setName).toBe("旅行");
  });
  it("preserves appearance in an exported set", () => {
    expect(createSetSharePayload(library(), "set").sets[0]).toMatchObject({
      hue: "violet",
      icon: "airplane-tilt",
    });
  });
  it("passes the shared appearance into a copied set", async () => {
    const state = library();
    const saveSet = vi.fn().mockResolvedValue({ ...state.sets[0], id: "copy" });
    await copySharedSet(
      createSetSharePayload(state, "set").sets[0],
      { setName: "旅行副本" },
      { saveSet, saveQuestion: vi.fn() },
    );
    expect(saveSet).toHaveBeenCalledWith(
      expect.objectContaining({
        setName: "旅行副本",
        hue: "violet",
        icon: "airplane-tilt",
      }),
    );
  });
});

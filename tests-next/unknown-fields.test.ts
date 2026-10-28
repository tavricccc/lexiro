import { describe, expect, it } from "vitest";
import {
  UNCATEGORIZED_FOLDER_ID,
  createUncategorizedFolder,
} from "@/src/lib/folders";
import { buildSenseId, buildSetWordKey } from "@/src/lib/library";
import { parseLibraryImportValue } from "@/src/lib/library-import";
import { normalizeLibraryState } from "@/src/lib/share";

const timestamp = "2026-10-28T00:00:00.000Z";
const wordKey = buildSetWordKey("set-1", "adapt");
const senseId = buildSenseId(wordKey, "v.", "適應");
const sense = {
  id: senseId,
  pos: "v.",
  meaningZh: "適應",
  examples: [],
  supplementary: false,
  laterField: "from a newer version",
};

describe("fields from a newer version", () => {
  it("are dropped when reading a stored library instead of failing it", () => {
    const state = normalizeLibraryState({
      version: 2,
      laterField: true,
      words: {
        [wordKey]: { wordKey, word: "adapt", senses: [sense], updatedAt: timestamp },
      },
      sets: [
        {
          id: "set-1",
          setName: "核心單字",
          folderId: UNCATEGORIZED_FOLDER_ID,
          createdAt: timestamp,
          updatedAt: timestamp,
          laterField: 1,
        },
      ],
      memberships: { "set-1": [{ wordKey, senseIds: [senseId] }] },
      folders: [createUncategorizedFolder()],
      questions: [],
      updatedAt: timestamp,
    });
    expect(state.words[wordKey].senses[0]).toEqual({
      id: senseId,
      pos: "v.",
      meaningZh: "適應",
      examples: [],
      supplementary: false,
    });
    expect(state.sets[0]).not.toHaveProperty("laterField");
  });

  it("are still reported in an imported file, which Agent writes also go through", () => {
    const parsed = parseLibraryImportValue({
      schemaVersion: 1,
      kind: "words",
      words: [{ wordKey, word: "adapt", senses: [sense], updatedAt: timestamp }],
    });
    expect(parsed).toMatchObject({ valid: false });
  });
});

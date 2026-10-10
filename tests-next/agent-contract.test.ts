import { describe, expect, it } from "vitest";
import {
  agentSetRevision,
  createAgentSet,
  mutateAgentSet,
  validateAgentSnapshot,
} from "@lexiro/agent-contract";
import { UNCATEGORIZED_FOLDER_ID } from "@/src/lib/folders";
const setId = "11111111-1111-4111-8111-111111111111";
const words = {
  type: "put_words",
  words: [
    {
      word: "rescue",
      senses: [
        {
          pos: "v.",
          meaningZh: "救援",
          examples: ["The volunteers rescued the stranded hikers."],
        },
      ],
    },
  ],
};
describe("agent set contract", () => {
  it("creates stable scoped identities and updates an existing sense", () => {
    const before = createAgentSet(setId, "測試");
    expect(before.set.folderId).toBe(UNCATEGORIZED_FOLDER_ID);
    const added = mutateAgentSet(before, words).snapshot!;
    const word = added.words[0];
    const changed = mutateAgentSet(added, {
      type: "put_words",
      words: [
        {
          wordKey: word.wordKey,
          word: word.word,
          senses: [{ ...word.senses[0], meaningZh: "營救" }],
        },
      ],
    });
    expect(changed.snapshot?.words[0].senses[0].meaningZh).toBe("營救");
    expect(changed.senseRemaps).toEqual([
      { from: word.senses[0].id, to: changed.snapshot!.words[0].senses[0].id },
    ]);
    expect(agentSetRevision(before)).not.toBe(agentSetRevision(added));
  });
  it("rejects a word identity from a different set", () => {
    const snapshot = mutateAgentSet(
      createAgentSet(setId, "測試"),
      words,
    ).snapshot!;
    expect(() =>
      validateAgentSnapshot(snapshot, "22222222-2222-4222-8222-222222222222"),
    ).toThrow();
    expect(() =>
      mutateAgentSet(snapshot, {
        type: "put_words",
        words: [{ ...words.words[0], wordKey: "word-foreign" }],
      }),
    ).toThrow("本集");
  });
  it("rejects question sources outside the delegated set", () => {
    const snapshot = mutateAgentSet(
      createAgentSet(setId, "測試"),
      words,
    ).snapshot!;
    const result = mutateAgentSet(snapshot, {
        type: "put_questions",
        questions: [
          {
            kind: "multipleChoice",
            questionStyle: "vocabulary",
            wordKey: "word-foreign",
            senseId: "sense-foreign",
            difficulty: 2,
            prompt: "The team _____ the hikers.",
            options: ["rescued", "ignored", "watched", "followed"],
            answerIndex: 0,
          },
        ],
      });
    expect(result.validation?.status).toBe("rejected");
    expect(result.validation?.savedCount).toBe(0);
    expect(result.validation?.errors[0].message).toContain("單字集");
    expect(result.snapshot?.questions).toEqual([]);
  });
  it("deletes owned words and the whole set", () => {
    const snapshot = mutateAgentSet(
      createAgentSet(setId, "測試"),
      words,
    ).snapshot!;
    expect(
      mutateAgentSet(snapshot, {
        type: "delete_words",
        wordKeys: [snapshot.words[0].wordKey],
      }).snapshot?.words,
    ).toEqual([]);
    expect(
      mutateAgentSet(snapshot, { type: "delete_set" }).snapshot,
    ).toBeNull();
  });
});

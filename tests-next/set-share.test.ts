import type {
  LibraryQuestion,
  LibraryState,
  SenseId,
  WordEntry,
} from "@/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createUncategorizedFolder,
  UNCATEGORIZED_FOLDER_ID,
} from "@/src/lib/folders";
import {
  buildSenseId,
  buildSetWordKey,
  canonicalizeQuestion,
  normalizeWordKey,
} from "@/src/lib/library";
import {
  copySharedSet,
  createSetSharePayload,
  parseSetShareValue,
} from "@/src/lib/set-share";
import { emptyLibraryState } from "@/src/lib/library-repository";
import { useLibraryStore } from "@/stores/library-store";

const mocks = vi.hoisted(() => ({ commit: vi.fn() }));
vi.mock("@/src/lib/library-repository", async (original) => ({
  ...(await original<typeof import("@/src/lib/library-repository")>()),
  getLibraryRepository: () => ({ commit: mocks.commit }),
}));
vi.mock("@/src/lib/sync-journal", () => ({
  recordLocalChanges: async () => {},
  untrackChanges: async () => {},
}));

beforeEach(() => {
  mocks.commit.mockReset().mockResolvedValue({ changed: [], removed: [] });
  useLibraryStore.setState({ state: emptyLibraryState(), status: "ready" });
});

const timestamp = "2026-08-17T00:00:00.000Z";
const wordKey = buildSetWordKey("set-1", "adapt");
const includedSenseId = buildSenseId(wordKey, "v.", "適應");
const otherSenseId = buildSenseId(wordKey, "v.", "改編");

function question(id: string, senseId: SenseId, clue: string): LibraryQuestion {
  return canonicalizeQuestion({
    id,
    fingerprint: "pending",
    kind: "multipleChoice",
    questionStyle: "vocabulary",
    difficulty: 1,
    wordKey,
    senseId,
    prompt: `The room felt _____ after ${clue}.`,
    options: ["adapt", "avoid", "delay", "remove"],
    answerIndex: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

function library(): LibraryState {
  const word: WordEntry = {
    wordKey,
    word: "adapt",
    senses: [
      {
        id: includedSenseId,
        pos: "v.",
        meaningZh: "適應",
        examples: ["We adapt quickly."],
        supplementary: true,
      },
      {
        id: otherSenseId,
        pos: "v.",
        meaningZh: "改編",
        examples: ["They adapted the novel."],
        supplementary: false,
      },
    ],
    updatedAt: timestamp,
  };
  return {
    version: 2,
    words: { [wordKey]: word },
    sets: [
      {
        id: "set-1",
        setName: "核心單字",
        folderId: UNCATEGORIZED_FOLDER_ID,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    memberships: { "set-1": [{ wordKey, senseIds: [includedSenseId] }] },
    folders: [createUncategorizedFolder()],
    questions: [
      question("included", includedSenseId, "to adjust to change"),
      question("excluded", otherSenseId, "to turn a novel into a film"),
    ],
    updatedAt: timestamp,
  };
}

describe("set sharing", () => {
  it("exports only the senses and questions owned by the selected set", () => {
    const payload = createSetSharePayload(library(), "set-1");
    expect(payload.sets[0].words[0].senses.map((sense) => sense.id)).toEqual([
      includedSenseId,
    ]);
    expect(payload.sets[0].questions.map((item) => item.id)).toEqual([
      "included",
    ]);
  });

  it("accepts the canonical share shape", () => {
    const payload = createSetSharePayload(library(), "set-1");
    const parsed = parseSetShareValue(payload);
    expect(parsed.kind).toBe("set-share");
    expect(parsed.version).toBe(2);
    expect(parsed.sets).toHaveLength(1);
  });

  it("migrates a v1 share into its original set scope before copying", () => {
    const payload = createSetSharePayload(library(), "set-1");
    const source = payload.sets[0];
    const oldSenseId = buildSenseId(normalizeWordKey("adapt"), "v.", "適應");
    const migrated = parseSetShareValue({
      ...payload,
      version: 1,
      sets: [
        {
          ...source,
          words: [
            {
              ...source.words[0],
              wordKey: "adapt",
              senses: [{ ...source.words[0].senses[0], id: oldSenseId }],
            },
          ],
          memberships: [{ wordKey: "adapt", senseIds: [oldSenseId] }],
          questions: source.questions.map((item) => ({
            ...item,
            wordKey: "adapt",
            senseId: oldSenseId,
          })),
        },
      ],
    });
    const member = migrated.sets[0].memberships[0];
    expect(migrated.version).toBe(2);
    expect(member.wordKey).toBe(buildSetWordKey("set-1", "adapt"));
    expect(migrated.sets[0].words[0].senses[0].id).toBe(member.senseIds[0]);
    expect(migrated.sets[0].questions[0]).toMatchObject({
      wordKey: member.wordKey,
      senseId: member.senseIds[0],
      prompt:
        source.questions[0].kind === "multipleChoice"
          ? source.questions[0].prompt
          : "",
    });
  });

  it("carries which senses were supplemented, and refuses a file that does not say", () => {
    const payload = createSetSharePayload(library(), "set-1");
    expect(payload.sets[0].words[0].senses[0].supplementary).toBe(true);
    expect(
      parseSetShareValue(payload).sets[0].words[0].senses[0].supplementary,
    ).toBe(true);
    const stripped = JSON.parse(JSON.stringify(payload)) as {
      sets: Array<{ words: Array<{ senses: Array<Record<string, unknown>> }> }>;
    };
    delete stripped.sets[0].words[0].senses[0].supplementary;
    expect(() => parseSetShareValue(stripped)).toThrow(/supplementary/u);
  });

  it("rejects a share whose membership points to an unknown sense", () => {
    const payload = JSON.parse(
      JSON.stringify(createSetSharePayload(library(), "set-1")),
    ) as {
      sets: Array<{ memberships: Array<{ senseIds: string[] }> }>;
    };
    payload.sets[0].memberships[0].senseIds = ["missing"];
    expect(() => parseSetShareValue(payload)).toThrow(/senseId/u);
  });

  it("copies the same share into independent sets while preserving whole saved reading packs", async () => {
    const source = library();
    source.questions = [
      source.questions[0],
      canonicalizeQuestion({
        id: "saved-reading",
        fingerprint: "pending",
        kind: "reading",
        format: "reading",
        difficulty: 1,
        title: "A new school",
        passage:
          "Mina joined a new school. Her classmates helped her adapt to its routines.",
        wordKeys: [wordKey],
        questions: ["first", "second"].map((id) => ({
          id,
          kind: "multipleChoice" as const,
          wordKey,
          senseId: includedSenseId,
          prompt:
            id === "first" ? "Who helped Mina?" : "What did Mina adapt to?",
          options:
            id === "first"
              ? [
                  "Her classmates",
                  "Her neighbors",
                  "Her cousins",
                  "Her parents",
                ]
              : [
                  "The school routines",
                  "The climate",
                  "Her parents",
                  "The bus routes",
                ],
          answerIndex: 0,
        })),
        createdAt: timestamp,
        updatedAt: timestamp,
      }),
    ];
    const shared = createSetSharePayload(source, "set-1").sets[0];
    const store = useLibraryStore.getState();
    const first = await copySharedSet(shared, { setName: "匯入一" }, store);
    const second = await copySharedSet(shared, { setName: "匯入二" }, store);
    const state = useLibraryStore.getState().state;
    const firstMember = state.memberships[first.id][0];
    const secondMember = state.memberships[second.id][0];

    expect(first.id).not.toBe(second.id);
    expect(firstMember.wordKey).not.toBe(secondMember.wordKey);
    expect(firstMember.senseIds[0]).not.toBe(secondMember.senseIds[0]);
    expect(firstMember.wordKey).toBe(buildSetWordKey(first.id, "adapt"));
    expect(secondMember.wordKey).toBe(buildSetWordKey(second.id, "adapt"));
    expect(state.questions).toHaveLength(4);
    expect(new Set(state.questions.map((item) => item.id)).size).toBe(4);
    expect(new Set(state.questions.map((item) => item.fingerprint)).size).toBe(
      4,
    );
    for (const member of [firstMember, secondMember]) {
      const pack = state.questions.find(
        (item) =>
          item.kind === "reading" && item.wordKeys.includes(member.wordKey),
      );
      if (!pack || pack.kind !== "reading")
        throw new Error("missing copied reading pack");
      expect(pack.passage).toBe(
        "Mina joined a new school. Her classmates helped her adapt to its routines.",
      );
      expect(pack.questions).toHaveLength(2);
      expect(
        pack.questions.every(
          (child) =>
            child.wordKey === member.wordKey &&
            child.senseId === member.senseIds[0],
        ),
      ).toBe(true);
      expect(pack.questions.map((child) => child.id)).not.toEqual([
        "first",
        "second",
      ]);
    }

    await store.saveSet({
      id: first.id,
      setName: first.setName,
      words: [
        {
          word: "adapt",
          pos: "v.",
          meaningZh: "適應",
          examples: ["The first copy was edited."],
          supplementary: true,
        },
      ],
    });
    const edited = useLibraryStore.getState().state;
    expect(edited.words[firstMember.wordKey].senses[0].examples).toEqual([
      "The first copy was edited.",
    ]);
    expect(edited.words[secondMember.wordKey].senses[0].examples).toEqual([
      "We adapt quickly.",
    ]);
    expect(edited.questions).toHaveLength(4);
    expect(shared.words[0].senses[0].examples).toEqual(["We adapt quickly."]);
  });
});

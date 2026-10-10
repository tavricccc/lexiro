import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QUESTION_GENERATION_CONTRACT } from "@lexiro/ai-contract";
import { QuestionGenerator } from "@/components/questions/question-generator";
import {
  rebindQuestionDraftSources,
  retainUnfinishedQuestionCheckpoint,
  type QuestionDraft,
} from "@/components/questions/question-generation-draft";
import { emptyLibraryState } from "@/src/lib/library-repository";
import {
  buildSenseId,
  buildSetWordKey,
  normalizeWordKey,
} from "@/src/lib/library";
import { UNCATEGORIZED_FOLDER_ID } from "@/src/lib/folders";
import { useLibraryStore } from "@/stores/library-store";
import type { LibraryQuestion, WordEntry } from "@/types";
import type { AiRunCheckpoint } from "@/src/lib/ai/run-checkpoint";

const { send } = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("@/src/lib/ai/session", async (original) => ({
  ...(await original<typeof import("@/src/lib/ai/session")>()),
  generateTurn: send,
}));
vi.mock("@/components/ai/ai-run-panel", () => ({
  AiRunPanel: () => <div>生成尚未開始</div>,
}));
const initialStore = useLibraryStore.getState();
const scrollDescriptor = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "scrollIntoView",
);

beforeEach(() => {
  localStorage.clear();
  send.mockReset();
  HTMLElement.prototype.scrollIntoView = vi.fn();
  useLibraryStore.setState({
    ...initialStore,
    state: emptyLibraryState(),
    status: "ready",
  });
});
afterEach(() => {
  cleanup();
  if (scrollDescriptor)
    Object.defineProperty(
      HTMLElement.prototype,
      "scrollIntoView",
      scrollDescriptor,
    );
  else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
});

function fixture() {
  const state = emptyLibraryState();
  const wordKey = normalizeWordKey("bank");
  const source: WordEntry = {
    wordKey,
    word: "bank",
    updatedAt: "2026-10-10",
    senses: [
      {
        id: buildSenseId(wordKey, "n.", "銀行"),
        pos: "n.",
        meaningZh: "銀行",
        examples: [],
        supplementary: false,
      },
    ],
  };
  const words = ["a", "b"].map((setId) => {
    const wordKey = buildSetWordKey(setId, "bank");
    const meaningZh = setId === "a" ? "河岸" : "銀行";
    const senseId = buildSenseId(wordKey, "n.", meaningZh);
    const word: WordEntry = {
      ...source,
      wordKey,
      senses: [{ ...source.senses[0], id: senseId, meaningZh }],
    };
    state.words[wordKey] = word;
    state.memberships[setId] = [{ wordKey, senseIds: [senseId] }];
    state.sets.push({
      id: setId,
      setName: setId === "a" ? "河流詞彙" : "金融詞彙",
      folderId: UNCATEGORIZED_FOLDER_ID,
      createdAt: "2026-10-10",
      updatedAt: "2026-10-10",
    });
    return word;
  });
  const single: LibraryQuestion = {
    id: "paid",
    fingerprint: "paid",
    kind: "multipleChoice",
    questionStyle: "vocabulary",
    wordKey: source.wordKey,
    senseId: source.senses[0].id,
    difficulty: 2,
    prompt: "I deposited the money in a _____.",
    options: ["bank", "roof", "desk", "gate"],
    answerIndex: 0,
    createdAt: "2026-10-10",
    updatedAt: "2026-10-10",
  };
  const pack: LibraryQuestion = {
    id: "paid-pack",
    fingerprint: "paid-pack",
    kind: "reading",
    format: "reading",
    title: "Depositing money",
    passage: "We deposited money in a bank.",
    difficulty: 2,
    wordKeys: [source.wordKey],
    questions: [
      {
        id: "paid-child",
        kind: "multipleChoice",
        wordKey: source.wordKey,
        senseId: source.senses[0].id,
        prompt: "Where was the money deposited?",
        options: ["bank", "roof", "desk", "gate"],
        answerIndex: 0,
      },
    ],
    createdAt: "2026-10-10",
    updatedAt: "2026-10-10",
  };
  const draft: QuestionDraft = {
    step: "review",
    chosenSetId: "b",
    kind: "vocabulary",
    difficulty: 2,
    excludedQuestionIds: [pack.id],
    run: {
      tier: "thinking",
      state: {
        status: "done",
        phase: "validating",
        characters: 50,
        completed: 2,
        total: 2,
        segments: 2,
        error: "",
        items: [single, pack],
        notices: [],
        startedAt: null,
        elapsedMs: 15000,
        remaining: 0,
        usage: { input: 1000, output: 200, cached: 800 },
        diagnostic: null,
      },
    },
  };
  return { state, words, single, pack, draft };
}

async function chooseSet(label: string) {
  fireEvent.keyDown(screen.getByRole("combobox", { name: "來源單字集" }), {
    key: "ArrowDown",
  });
  fireEvent.keyDown(await screen.findByRole("option", { name: label }), {
    key: "Enter",
  });
}

describe("paid question drafts after independent-set migration", () => {
  it("rebinds accepted items at every checkpoint layer while retaining all operation identities and usage", () => {
    const { words, single, pack, draft } = fixture();
    const session = {
      model: "gpt-5.6-luna" as const,
      tier: "thinking" as const,
      sessionId: "paid-session",
      context: "unchanged paid context",
      cursor: "response-id",
      pendingTurn: {
        id: "existing-operation",
        signature: "original-input-signature",
        started: true,
        createdAt: 123,
      },
      usage: { input: 1000, output: 200 },
      notices: [],
    };
    const leaf: AiRunCheckpoint<LibraryQuestion>["run"] = {
      session,
      pending: [{ root: "original-step" }],
      items: [single],
      completed: 1,
      total: 2,
      segments: 1,
    };
    draft.run!.checkpoint = {
      schemaVersion: 1,
      contract: QUESTION_GENERATION_CONTRACT,
      accountId: "local",
      taskId: "old-task-id",
      context: "original task context",
      groups: [],
      run: {
        ...leaf,
        items: [single, pack],
        parallel: {
          base: {
            items: [pack],
            completed: 1,
            segments: 1,
            usage: { cached: 800 },
            notices: [],
          },
          warmed: true,
          lanes: [["original-lane", leaf]],
        },
      },
    };
    const original = JSON.stringify(draft);
    const rebound = rebindQuestionDraftSources(draft, "b", [words[1]]);
    expect(JSON.stringify(draft)).toBe(original);
    expect(rebound.run!.state.items[0]).toMatchObject({
      wordKey: words[1].wordKey,
      senseId: words[1].senses[0].id,
    });
    expect(rebound.excludedQuestionIds).toEqual([
      rebound.run!.state.items[1].id,
    ]);
    const stored = rebound.run!.checkpoint!;
    expect(stored.taskId).toBe("old-task-id");
    expect(stored.context).toBe("original task context");
    expect(stored.groups).toEqual(draft.run!.checkpoint.groups);
    expect(stored.run.session).toEqual(session);
    expect(stored.run.pending).toEqual(leaf.pending);
    expect(stored.run.parallel!.lanes[0][0]).toBe("original-lane");
    expect(stored.run.parallel!.lanes[0][1].session).toEqual(session);
    expect(stored.run.parallel!.lanes[0][1].items[0]).toMatchObject({
      wordKey: words[1].wordKey,
    });
    expect(stored.run.parallel!.base.usage).toEqual({ cached: 800 });
    expect(stored.run.parallel!.base.items[0]).toMatchObject({
      wordKeys: [words[1].wordKey],
      questions: [
        expect.objectContaining({
          wordKey: words[1].wordKey,
          senseId: words[1].senses[0].id,
        }),
      ],
    });
    expect(rebound.run!.state.usage).toEqual(draft.run!.state.usage);
    const blocked = {
      ...rebound.run!,
      checkpoint: undefined,
      state: {
        ...rebound.run!.state,
        remaining: 1,
        resumeUnavailable: "changed" as const,
      },
    };
    expect(
      retainUnfinishedQuestionCheckpoint(rebound.run, blocked).checkpoint,
    ).toEqual(stored);
    const newRun = {
      ...blocked,
      state: { ...blocked.state, remaining: 0, resumeUnavailable: undefined },
    };
    expect(retainUnfinishedQuestionCheckpoint(rebound.run, newRun)).toBe(
      newRun,
    );
    const newCheckpoint = {
      ...stored,
      taskId: "current-task",
      run: { ...stored.run, session: { ...session, sessionId: "new-session" } },
    };
    const validNewSnapshot = { ...blocked, checkpoint: newCheckpoint };
    expect(
      retainUnfinishedQuestionCheckpoint(rebound.run, validNewSnapshot),
    ).toBe(validNewSnapshot);
    expect(
      retainUnfinishedQuestionCheckpoint(rebound.run, validNewSnapshot)
        .checkpoint!.run.session.sessionId,
    ).toBe("new-session");
  });

  it("preserves a mismatched paid draft and recovers locally only after the user chooses its exact source set", async () => {
    const { state, words, draft } = fixture();
    draft.chosenSetId = "a";
    const key = "lexiro:flow-draft:v1:local:questions:all";
    const original = JSON.stringify({ schemaVersion: 1, value: draft });
    localStorage.setItem(key, original);
    useLibraryStore.setState({ state });
    render(<QuestionGenerator />);
    fireEvent.click(await screen.findByRole("button", { name: "接續上次" }));
    expect(
      await screen.findByRole("heading", { name: "恢復已完成題目" }),
    ).toBeVisible();
    expect(localStorage.getItem(key)).toBe(original);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "題目詞義不在這個單字集中",
    );
    expect(
      screen.queryByRole("button", { name: /儲存選取/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("I deposited the money in a _____.")).toBeVisible();
    expect(send).not.toHaveBeenCalled();
    await chooseSet("金融詞彙");
    fireEvent.click(screen.getByRole("button", { name: "重新對應已完成題目" }));
    expect(
      await screen.findByRole("heading", { name: "校對題目" }),
    ).toBeVisible();
    await waitFor(() =>
      expect(
        JSON.parse(localStorage.getItem(key)!).value.run.state.items[0].wordKey,
      ).toBe(words[1].wordKey),
    );
    expect(
      JSON.parse(localStorage.getItem(key)!).value.run.state.usage,
    ).toEqual(draft.run!.state.usage);
    expect(send).not.toHaveBeenCalled();
  });

  it("requires an explicit set for an older all-library draft that never recorded its default owner", async () => {
    const { state, draft } = fixture();
    draft.chosenSetId = "";
    localStorage.setItem(
      "lexiro:flow-draft:v1:local:questions:all",
      JSON.stringify({ schemaVersion: 1, value: draft }),
    );
    useLibraryStore.setState({ state });
    render(<QuestionGenerator />);
    fireEvent.click(await screen.findByRole("button", { name: "接續上次" }));
    expect(
      await screen.findByRole("heading", { name: "恢復已完成題目" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "重新對應已完成題目" }),
    ).toBeDisabled();
    await chooseSet("金融詞彙");
    fireEvent.click(screen.getByRole("button", { name: "重新對應已完成題目" }));
    expect(
      await screen.findByRole("heading", { name: "校對題目" }),
    ).toBeVisible();
    expect(send).not.toHaveBeenCalled();
  });

  it("persists the actual default set before beginning a new generation flow", async () => {
    const { state } = fixture();
    useLibraryStore.setState({ state });
    render(<QuestionGenerator />);
    fireEvent.click(await screen.findByRole("button", { name: "下一步" }));
    expect(
      JSON.parse(
        localStorage.getItem("lexiro:flow-draft:v1:local:questions:all")!,
      ).value.chosenSetId,
    ).toBe("a");
    expect(send).not.toHaveBeenCalled();
  });
});

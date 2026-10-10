import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SetSenseSupplement } from "@/components/library/set-sense-supplement";
import { rebindSupplementSources } from "@/components/library/supplement-source-scope";
import { supplementTask } from "@/src/lib/ai/tasks";
import { restoreRunCheckpoint } from "@/src/lib/ai/run-checkpoint";
import { emptyLibraryState } from "@/src/lib/library-repository";
import {
  buildSenseId,
  buildSetWordKey,
  normalizeWordKey,
} from "@/src/lib/library";
import { UNCATEGORIZED_FOLDER_ID } from "@/src/lib/folders";
import { useLibraryStore } from "@/stores/library-store";
import type { AiGenerationSnapshot } from "@/components/ai/use-ai-generation";
import type { WordDraft, WordEntry } from "@/types";

const mocks = vi.hoisted(() => ({
  commit: vi.fn(),
  send: vi.fn(),
  generation: vi.fn(),
  push: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/src/lib/library-repository", async (original) => ({
  ...(await original<typeof import("@/src/lib/library-repository")>()),
  getLibraryRepository: () => ({ commit: mocks.commit }),
}));
vi.mock("@/src/lib/sync-journal", () => ({
  recordLocalChanges: async () => {},
  untrackChanges: async () => {},
}));
vi.mock("@/src/lib/ai/session", async (original) => ({
  ...(await original<typeof import("@/src/lib/ai/session")>()),
  generateTurn: mocks.send,
}));
vi.mock("@/components/ai/use-ai-generation", async (original) => {
  const module =
    await original<typeof import("@/components/ai/use-ai-generation")>();
  return {
    ...module,
    useAiGeneration: (
      options: Parameters<typeof module.useAiGeneration>[0],
    ) => {
      mocks.generation(options);
      return module.useAiGeneration(options);
    },
  };
});
const initialStore = useLibraryStore.getState();
const queryClient = new QueryClient();
beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  mocks.commit.mockResolvedValue({ changed: [], removed: [] });
  useLibraryStore.setState({
    ...initialStore,
    state: emptyLibraryState(),
    status: "ready",
  });
});
afterEach(() => {
  cleanup();
  queryClient.clear();
});

function fixture() {
  const state = emptyLibraryState();
  const words = ["river-set", "money-set"].map((setId) => {
    const wordKey = buildSetWordKey(setId, "bank");
    const meaningZh = setId === "river-set" ? "河岸" : "銀行";
    const word: WordEntry = {
      wordKey,
      word: "bank",
      updatedAt: "2026-10-10",
      senses: [
        {
          id: buildSenseId(wordKey, "n.", meaningZh),
          pos: "n.",
          meaningZh,
          examples: [
            setId === "river-set"
              ? "We sat on the bank."
              : "The bank approved the loan.",
          ],
          supplementary: false,
        },
      ],
    };
    state.sets.push({
      id: setId,
      setName: setId,
      folderId: UNCATEGORIZED_FOLDER_ID,
      createdAt: "2026-10-10",
      updatedAt: "2026-10-10",
    });
    state.words[wordKey] = word;
    state.memberships[setId] = [
      { wordKey, senseIds: word.senses.map((sense) => sense.id) },
    ];
    return word;
  });
  const run: AiGenerationSnapshot<WordDraft> = {
    tier: "lite",
    state: {
      status: "done",
      phase: "validating",
      characters: 100,
      completed: 1,
      total: 1,
      segments: 1,
      error: "",
      items: [
        {
          word: "bank",
          senses: [
            {
              id: "generated-sense",
              pos: "v.",
              meaning: "使飛機傾斜轉彎",
              examples: ["The pilot banked the plane gently."],
              supplementary: true,
            },
          ],
        },
      ],
      notices: [],
      startedAt: null,
      elapsedMs: 15000,
      remaining: 0,
      usage: { input: 1000, output: 200 },
      diagnostic: null,
    },
  };
  return { state, river: words[0], money: words[1], run };
}

describe("supplement selections after set isolation", () => {
  it("rebinds legacy spelling only within the chosen set and restores the original paid operation", () => {
    const { river, money, run } = fixture();
    const chosen = [normalizeWordKey("bank")];
    const rebound = rebindSupplementSources(chosen, [river]);
    expect(rebound).toEqual({ selected: [river.wordKey], missing: [] });
    expect(rebindSupplementSources([money.wordKey], [river])).toEqual({
      selected: [],
      missing: [money.wordKey],
    });
    const sources = [river]
      .filter((word) => rebound.selected.includes(word.wordKey))
      .map((word) => ({
        word: word.word,
        existing: word.senses.map((sense) => ({
          pos: sense.pos,
          meaningZh: sense.meaningZh,
        })),
      }));
    const task = supplementTask(sources, 1);
    expect(task.billableCount).toBe(1);
    const session = {
      model: "gpt-5.6-luna" as const,
      tier: "lite" as const,
      sessionId: "existing-paid-session",
      context: task.context,
      pendingTurn: {
        id: "existing-paid-operation",
        signature: "original-input-signature",
        started: true,
        createdAt: Date.now(),
      },
      notices: [],
      usage: run.state.usage,
    };
    const checkpoint = {
      schemaVersion: 1 as const,
      contract: "run-v1",
      accountId: "local",
      taskId: task.id,
      context: task.context,
      groups: [],
      run: {
        session,
        pending: [{ root: "bank" }],
        items: [],
        completed: 0,
        total: 1,
        segments: 0,
      },
    };
    const original = JSON.stringify(checkpoint);
    const restored = restoreRunCheckpoint(checkpoint, task, "local");
    expect(restored.reason).toBeUndefined();
    expect(restored.run!.pending).toHaveLength(1);
    expect(restored.run!.session).toEqual(session);
    expect(restored.run!.session.pendingTurn!.id).toBe(
      "existing-paid-operation",
    );
    expect(restored.run!.task.context).toBe(checkpoint.context);
    expect(JSON.stringify(checkpoint)).toBe(original);
  });

  it("saves a restored river-set supplement through the real store while the other bank stays independent", async () => {
    const { state, river, money, run } = fixture();
    const unchangedMoney = JSON.stringify(money);
    const key = "lexiro:flow-draft:v1:local:supplement:river-set";
    localStorage.setItem(
      key,
      JSON.stringify({
        schemaVersion: 1,
        value: {
          chosen: [normalizeWordKey("bank")],
          limit: 1,
          phase: "run",
          run,
        },
      }),
    );
    useLibraryStore.setState({ state });
    render(
      <QueryClientProvider client={queryClient}>
        <SetSenseSupplement setId="river-set" />
      </QueryClientProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "接續上次" }));
    const apply = await screen.findByRole("button", { name: "加入這些詞義" });
    const restored = JSON.parse(localStorage.getItem(key)!).value;
    expect(restored.chosen).toEqual([river.wordKey]);
    expect(restored.run).toEqual(run);
    expect(mocks.generation.mock.calls[0][0].task.billableCount).toBe(1);
    fireEvent.click(apply);
    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith("/app/sets/river-set"),
    );
    const saved = useLibraryStore.getState().state;
    expect(
      saved.words[river.wordKey].senses.map((sense) => sense.meaningZh),
    ).toEqual(["河岸", "使飛機傾斜轉彎"]);
    expect(JSON.stringify(saved.words[money.wordKey])).toBe(unchangedMoney);
    expect(saved.memberships["money-set"]).toEqual(
      state.memberships["money-set"],
    );
    expect(saved.questions).toEqual([]);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("keeps unknown sources and paid output on disk without mounting a generation hook", async () => {
    const { state, run } = fixture();
    run.state.items[0] = {
      word: "plot",
      senses: [
        {
          id: "generated-plot-sense",
          pos: "n.",
          meaning: "劇情",
          examples: ["The film has a clever plot."],
          supplementary: true,
        },
      ],
    };
    const key = "lexiro:flow-draft:v1:local:supplement:river-set";
    const original = JSON.stringify({
      schemaVersion: 1,
      value: {
        chosen: [normalizeWordKey("plot")],
        limit: 1,
        phase: "run",
        run,
      },
    });
    localStorage.setItem(key, original);
    useLibraryStore.setState({ state });
    render(<SetSenseSupplement setId="river-set" />);
    fireEvent.click(await screen.findByRole("button", { name: "接續上次" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "原本選取的部分單字已不在本集中",
    );
    expect(screen.getByText("plot")).toBeVisible();
    expect(screen.getByRole("button", { name: "確認本集來源" })).toBeDisabled();
    expect(localStorage.getItem(key)).toBe(original);
    expect(mocks.generation).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });
});

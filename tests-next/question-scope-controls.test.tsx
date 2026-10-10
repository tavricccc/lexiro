import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SetView } from "@/components/library/set-view";
import { QuestionBankPage } from "@/components/questions/question-bank-page";
import { QuestionEditor } from "@/components/questions/question-editor";
import { ReadingEditor } from "@/components/questions/reading-editor";
import { readingFormFromPack } from "@/components/questions/reading-form";
import { emptyLibraryState } from "@/src/lib/library-repository";
import { buildSenseId, senseKey } from "@/src/lib/library";
import { questionBelongsToMemberships } from "@/src/lib/question-ownership";
import { UNCATEGORIZED_FOLDER_ID } from "@/src/lib/folders";
import { useLibraryStore } from "@/stores/library-store";
import type { MultipleChoiceQuestion, ReadingPack, WordKey } from "@/types";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const initialStore = useLibraryStore.getState();
const scrollDescriptor = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "scrollIntoView",
);

beforeEach(() => {
  localStorage.clear();
  push.mockClear();
  useLibraryStore.setState({
    ...initialStore,
    state: emptyLibraryState(),
    status: "ready",
  });
  HTMLElement.prototype.scrollIntoView = vi.fn();
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

function libraryFixture() {
  const state = emptyLibraryState();
  function source(id: string, setName: string, meaningZh: string) {
    const wordKey = `${id}:opaque-bank` as WordKey;
    const senseId = buildSenseId(wordKey, "n.", meaningZh);
    state.sets.push({
      id,
      setName,
      folderId: UNCATEGORIZED_FOLDER_ID,
      createdAt: "2026-10-10",
      updatedAt: "2026-10-10",
    });
    state.words[wordKey] = {
      wordKey,
      word: "bank",
      senses: [
        {
          id: senseId,
          pos: "n.",
          meaningZh,
          examples: [],
          supplementary: false,
        },
      ],
      updatedAt: "2026-10-10",
    };
    state.memberships[id] = [{ wordKey, senseIds: [senseId] }];
    return { wordKey, senseId, value: senseKey(wordKey, senseId) };
  }
  const a = source("a", "河流詞彙", "河岸");
  const b = source("b", "金融詞彙", "銀行");
  const single: MultipleChoiceQuestion = {
    id: "single",
    fingerprint: "single",
    kind: "multipleChoice",
    questionStyle: "vocabulary",
    wordKey: a.wordKey,
    senseId: a.senseId,
    prompt: "We sat on the river _____.",
    options: ["bank", "roof", "desk", "gate"],
    answerIndex: 0,
    difficulty: 2,
    createdAt: "2026-10-10",
    updatedAt: "2026-10-10",
  };
  const reading: ReadingPack = {
    id: "reading",
    fingerprint: "reading",
    kind: "reading",
    format: "reading",
    title: "A riverside walk",
    passage: "We sat on the river bank.",
    wordKeys: [a.wordKey],
    difficulty: 2,
    createdAt: "2026-10-10",
    updatedAt: "2026-10-10",
    questions: [0, 1].map((index) => ({
      id: `child-${index}`,
      kind: "multipleChoice",
      prompt: `Where did we sit? ${index}`,
      options: ["bank", "roof", "desk", "gate"],
      answerIndex: 0,
      wordKey: a.wordKey,
      senseId: a.senseId,
    })),
  };
  state.questions = [
    single,
    reading,
    { ...single, id: "retired", questionStyle: "grammar" },
    { ...single, id: "other", wordKey: b.wordKey, senseId: b.senseId },
  ];
  return { state, a, b, single, reading };
}

async function chooseOption(name: string, label: string) {
  fireEvent.keyDown(screen.getByRole("combobox", { name }), {
    key: "ArrowDown",
  });
  const option = await screen.findByRole("option", { name: label });
  fireEvent.keyDown(option, { key: "Enter" });
}

describe("independent set question controls", () => {
  it("counts all saved set questions and retains failed clear feedback until a persisted retry finishes", async () => {
    const { state } = libraryFixture();
    let finish!: () => void;
    const clearQuestions = vi
      .fn()
      .mockRejectedValueOnce(new Error("裝置暫時無法寫入"))
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      );
    useLibraryStore.setState({ state, clearQuestions });
    render(<SetView setId="a" initialTab="questions" />);
    fireEvent.click(screen.getByRole("button", { name: "清空本集全部題目" }));
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "「河流詞彙」的全部 4 題",
    );
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "包含 1 組閱讀／文章題組",
    );
    fireEvent.click(screen.getByRole("button", { name: "確認清空" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "裝置暫時無法寫入",
    );
    expect(useLibraryStore.getState().state.questions).toHaveLength(4);
    expect(
      screen.queryByText("已清空 4 題，可以重新生成。"),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "重試" }));
    expect(
      await screen.findByRole("button", { name: "正在處理…" }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "正在處理…" }));
    expect(clearQuestions).toHaveBeenCalledTimes(2);
    expect(clearQuestions).toHaveBeenLastCalledWith("a");
    await act(async () => {
      useLibraryStore.setState({
        state: {
          ...state,
          questions: state.questions.filter(
            (question) =>
              !questionBelongsToMemberships(question, state.memberships.a),
          ),
        },
      });
      finish();
    });
    expect(
      await screen.findByText("已清空 4 題，可以重新生成。"),
    ).toBeVisible();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      useLibraryStore.getState().state.questions.map((question) => question.id),
    ).toEqual(["other"]);
  });

  it("clears the entire bank regardless of a search filter and cancellation preserves it", async () => {
    const { state } = libraryFixture();
    const clearQuestions = vi.fn(async () => {
      useLibraryStore.setState({ state: { ...state, questions: [] } });
    });
    useLibraryStore.setState({ state, clearQuestions });
    render(<QuestionBankPage initialFilters={{ q: "missing" }} />);
    fireEvent.click(screen.getByRole("button", { name: "清空全部題目" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("整個題庫的全部 5 題");
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(clearQuestions).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "清空全部題目" }));
    fireEvent.click(screen.getByRole("button", { name: "確認清空" }));
    expect(
      await screen.findByText("已清空 5 題，可以重新生成。"),
    ).toBeVisible();
    expect(clearQuestions).toHaveBeenCalledWith(undefined);
  });

  it("keeps a saved question in its original set and blocks a foreign source restored from a draft", async () => {
    const { state, a, b, single } = libraryFixture();
    const saveQuestion = vi.fn().mockResolvedValue("saved");
    useLibraryStore.setState({ state, saveQuestion });
    localStorage.setItem(
      "lexiro:flow-draft:v1:local:edit-question:single:2026-10-10",
      JSON.stringify({
        schemaVersion: 1,
        value: {
          ...single,
          explanation: "",
          source: b.value,
          selectedSetId: "b",
          reasonsVersion: 1,
        },
      }),
    );
    render(<QuestionEditor questionId="single" />);
    fireEvent.click(await screen.findByRole("button", { name: "接續上次" }));
    expect(screen.getByRole("combobox", { name: "來源單字集" })).toBeDisabled();
    expect(
      screen.getByRole("combobox", { name: "來源單字集" }),
    ).toHaveTextContent("河流詞彙");
    fireEvent.click(screen.getByRole("button", { name: "儲存題目" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "請選擇來源單字集中的詞義",
    );
    expect(saveQuestion).not.toHaveBeenCalled();
    await chooseOption("關聯詞義", "bank · n. 河岸");
    expect(
      screen.queryByRole("option", { name: "bank · n. 銀行" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "儲存題目" }));
    await waitFor(() => expect(saveQuestion).toHaveBeenCalledOnce());
    expect(saveQuestion.mock.calls[0][0].wordKey).toBe(a.wordKey);
  });

  it("switches a new reading draft to one set, clears all old sources and preserves passage and selection after interruption", async () => {
    const { state, reading, b } = libraryFixture();
    const saveQuestion = vi.fn().mockResolvedValue("saved");
    useLibraryStore.setState({ state, saveQuestion });
    localStorage.setItem(
      "lexiro:flow-draft:v1:local:edit-reading:new:new",
      JSON.stringify({
        schemaVersion: 1,
        value: { ...readingFormFromPack(reading), selectedSetId: "a" },
      }),
    );
    const first = render(<ReadingEditor readingId="new" />);
    fireEvent.click(await screen.findByRole("button", { name: "接續上次" }));
    await chooseOption("來源單字集", "金融詞彙");
    expect(screen.getByRole("textbox", { name: "文章內容" })).toHaveValue(
      reading.passage,
    );
    const stored = JSON.parse(
      localStorage.getItem("lexiro:flow-draft:v1:local:edit-reading:new:new")!,
    ).value;
    expect(stored.selectedSetId).toBe("b");
    expect(
      stored.children.map((child: { source: string }) => child.source),
    ).toEqual(["", ""]);
    fireEvent.click(screen.getByRole("button", { name: "儲存題目" }));
    expect(saveQuestion).not.toHaveBeenCalled();
    await chooseOption("關聯詞義", "bank · n. 銀行");
    first.unmount();
    render(<ReadingEditor readingId="new" />);
    fireEvent.click(await screen.findByRole("button", { name: "接續上次" }));
    expect(
      screen.getByRole("combobox", { name: "來源單字集" }),
    ).toHaveTextContent("金融詞彙");
    expect(screen.getByRole("textbox", { name: "文章內容" })).toHaveValue(
      reading.passage,
    );
    const recovered = JSON.parse(
      localStorage.getItem("lexiro:flow-draft:v1:local:edit-reading:new:new")!,
    ).value;
    expect(recovered.children[0].source).toBe(b.value);
    expect(recovered.children[1].source).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "下一題" }));
    await chooseOption("關聯詞義", "bank · n. 銀行");
    fireEvent.click(screen.getByRole("button", { name: "儲存題目" }));
    await waitFor(() => expect(saveQuestion).toHaveBeenCalledOnce());
    expect(saveQuestion.mock.calls[0][0].wordKeys).toEqual([b.wordKey]);
    expect(
      saveQuestion.mock.calls[0][0].questions.map(
        (child: { wordKey: WordKey }) => child.wordKey,
      ),
    ).toEqual([b.wordKey, b.wordKey]);
  });

  it("rejects a foreign reading child from a restored draft while locking the original set", async () => {
    const { state, reading, a, b } = libraryFixture();
    const saveQuestion = vi.fn().mockResolvedValue("saved");
    useLibraryStore.setState({ state, saveQuestion });
    const draft = readingFormFromPack(reading);
    draft.children[1].source = b.value;
    localStorage.setItem(
      "lexiro:flow-draft:v1:local:edit-reading:reading:2026-10-10",
      JSON.stringify({
        schemaVersion: 1,
        value: { ...draft, selectedSetId: "b" },
      }),
    );
    render(<ReadingEditor readingId="reading" />);
    fireEvent.click(await screen.findByRole("button", { name: "接續上次" }));
    expect(screen.getByRole("combobox", { name: "來源單字集" })).toBeDisabled();
    expect(
      screen.getByRole("combobox", { name: "來源單字集" }),
    ).toHaveTextContent("河流詞彙");
    fireEvent.click(screen.getByRole("button", { name: "儲存題目" }));
    expect(await screen.findByText("請選擇來源單字集中的詞義。")).toBeVisible();
    expect(saveQuestion).not.toHaveBeenCalled();
    await chooseOption("關聯詞義", "bank · n. 河岸");
    fireEvent.click(screen.getByRole("button", { name: "儲存題目" }));
    await waitFor(() => expect(saveQuestion).toHaveBeenCalledOnce());
    expect(saveQuestion.mock.calls[0][0].wordKeys).toEqual([a.wordKey]);
  });
});

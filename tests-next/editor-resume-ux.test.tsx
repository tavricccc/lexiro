import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WordEditPage } from "@/components/library/word-edit-page";
import { WordEditor } from "@/components/library/word-editor";
import { SetMetadata } from "@/components/library/set-metadata";
import { QuestionEditor } from "@/components/questions/question-editor";
import { ReadingEditor } from "@/components/questions/reading-editor";
import { emptyLibraryState } from "@/src/lib/library-repository";
import { UNCATEGORIZED_FOLDER_ID } from "@/src/lib/folders";
import { buildSenseId, normalizeWordKey } from "@/src/lib/library";
import { useLibraryStore } from "@/stores/library-store";
import type { ReadingPack } from "@/types";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const scrollDescriptor = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "scrollIntoView",
);
const originalSaveQuestion = useLibraryStore.getState().saveQuestion;

beforeEach(() => {
  push.mockClear();
  localStorage.clear();
  useLibraryStore.setState({
    state: emptyLibraryState(),
    status: "ready",
    saveQuestion: originalSaveQuestion,
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

describe("interrupted manual edits", () => {
  it("restores an unsaved set name after leaving metadata settings", async () => {
    const state = emptyLibraryState();
    state.sets = [
      {
        id: "set",
        setName: "Original",
        folderId: UNCATEGORIZED_FOLDER_ID,
        createdAt: "2026-09-26",
        updatedAt: "2026-09-26",
      },
    ];
    useLibraryStore.setState({ state });

    const first = render(<SetMetadata setId="set" />);
    const name = await screen.findByRole("textbox", { name: "單字集名稱" });
    fireEvent.change(name, { target: { value: "Renamed draft" } });
    first.unmount();

    render(<SetMetadata setId="set" />);
    fireEvent.click(await screen.findByRole("button", { name: "接續上次" }));
    expect(screen.getByRole("textbox", { name: "單字集名稱" })).toHaveValue(
      "Renamed draft",
    );
  });

  it("focuses the first incomplete sense from the fixed word save action", () => {
    render(
      <WordEditor
        value={{
          word: "apple",
          senses: [
            {
              id: "a",
              pos: "",
              meaning: "",
              examples: [],
              supplementary: false,
            },
          ],
        }}
        onCancel={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "儲存此單字" }));
    expect(screen.getByRole("textbox", { name: "詞性" })).toHaveFocus();
    expect(
      screen.getByText("還有欄位沒填完，已帶你到第一個需要補齊的位置。"),
    ).toBeVisible();
  });

  it("restores an unsaved word meaning after leaving the editor", async () => {
    const state = emptyLibraryState();
    const wordKey = normalizeWordKey("apple");
    const senseId = buildSenseId(wordKey, "n.", "蘋果");
    state.words[wordKey] = {
      wordKey,
      word: "apple",
      updatedAt: "2026-09-26",
      senses: [
        {
          id: senseId,
          pos: "n.",
          meaningZh: "蘋果",
          examples: [],
          supplementary: false,
        },
      ],
    };
    state.memberships.set = [{ wordKey, senseIds: [senseId] }];
    useLibraryStore.setState({ state });

    const first = render(<WordEditPage setId="set" wordKey={wordKey} />);
    const meaning = await screen.findByRole("textbox", { name: "中文意思" });
    fireEvent.change(meaning, { target: { value: "新的意思" } });
    expect(await screen.findByText("進度已儲存，離開後可接續")).toBeVisible();
    first.unmount();

    render(<WordEditPage setId="set" wordKey={wordKey} />);
    fireEvent.click(await screen.findByRole("button", { name: "接續上次" }));
    expect(screen.getByRole("textbox", { name: "中文意思" })).toHaveValue(
      "新的意思",
    );
  });

  it("restores a manually edited question", async () => {
    const first = render(<QuestionEditor questionId="new" />);
    const prompt = await screen.findByRole("textbox", { name: "題幹" });
    fireEvent.change(prompt, { target: { value: "Which word fits?" } });
    await waitFor(() =>
      expect(screen.getByText("進度已儲存，離開後可接續")).toBeVisible(),
    );
    first.unmount();

    render(<QuestionEditor questionId="new" />);
    fireEvent.click(await screen.findByRole("button", { name: "接續上次" }));
    expect(screen.getByRole("textbox", { name: "題幹" })).toHaveValue(
      "Which word fits?",
    );
  });

  it("keeps reading validation beside save and moves focus to the missing title", async () => {
    render(<ReadingEditor readingId="new" />);
    const title = await screen.findByRole("textbox", { name: "文章標題" });
    fireEvent.click(screen.getByRole("button", { name: "儲存題目" }));
    await waitFor(() => expect(title).toHaveFocus());
    expect(screen.getByText("還有欄位沒填完，補齊後就能儲存。")).toBeVisible();
  });

  it("uses edited distractor reasons in both the single-question preview and saved question", async () => {
    const state = emptyLibraryState();
    const wordKey = normalizeWordKey("observe");
    const senseId = buildSenseId(wordKey, "v.", "觀察");
    state.words[wordKey] = {
      wordKey,
      word: "observe",
      updatedAt: "2026-10-03",
      senses: [
        {
          id: senseId,
          pos: "v.",
          meaningZh: "觀察",
          examples: [],
          supplementary: false,
        },
      ],
    };
    state.sets = [
      {
        id: "set",
        setName: "觀察練習",
        folderId: UNCATEGORIZED_FOLDER_ID,
        createdAt: "2026-10-03",
        updatedAt: "2026-10-03",
      },
    ];
    state.memberships.set = [{ wordKey, senseIds: [senseId] }];
    state.questions = [
      {
        id: "reason-question",
        fingerprint: "reason-question",
        kind: "multipleChoice",
        questionStyle: "vocabulary",
        difficulty: 2,
        createdAt: "2026-10-03",
        updatedAt: "2026-10-03",
        wordKey,
        senseId,
        prompt:
          "The students _____ the classroom before deciding what to change.",
        options: ["observe", "compare", "record", "collect"],
        answerIndex: 0,
        whyWrong: { compare: "原本的解析。" },
      },
    ];
    const saveQuestion = vi.fn().mockResolvedValue("saved");
    useLibraryStore.setState({ state, saveQuestion });
    render(<QuestionEditor questionId="reason-question" />);
    await screen.findByRole("textbox", { name: "題幹" });
    fireEvent.click(screen.getByText("干擾選項解析"));
    const reason = await screen.findByRole("textbox", { name: "B · compare" });
    fireEvent.change(reason, {
      target: { value: "題幹尚未提供兩個可比較的結果。" },
    });
    expect(
      screen.getByText("題幹尚未提供兩個可比較的結果。", { selector: "dd" }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "儲存題目" }));
    await waitFor(() => expect(saveQuestion).toHaveBeenCalledOnce());
    expect(saveQuestion.mock.calls[0][0].whyWrong).toEqual({
      compare: "題幹尚未提供兩個可比較的結果。",
    });
  });

  it("restores a reading passage after interruption", async () => {
    const first = render(<ReadingEditor readingId="new" />);
    const passage = await screen.findByRole("textbox", { name: "文章內容" });
    fireEvent.change(passage, { target: { value: "A saved draft passage." } });
    first.unmount();

    render(<ReadingEditor readingId="new" />);
    fireEvent.click(await screen.findByRole("button", { name: "接續上次" }));
    expect(screen.getByRole("textbox", { name: "文章內容" })).toHaveValue(
      "A saved draft passage.",
    );
  });

  it("shows saving feedback and blocks a second reading save", async () => {
    const state = emptyLibraryState();
    const wordKey = normalizeWordKey("apple");
    const senseId = buildSenseId(wordKey, "n.", "蘋果");
    state.words[wordKey] = {
      wordKey,
      word: "apple",
      updatedAt: "2026-09-26",
      senses: [
        {
          id: senseId,
          pos: "n.",
          meaningZh: "蘋果",
          examples: [],
          supplementary: false,
        },
      ],
    };
    const reading: ReadingPack = {
      id: "reading",
      kind: "reading",
      format: "reading",
      fingerprint: "test",
      difficulty: 2,
      createdAt: "2026-09-26",
      updatedAt: "2026-09-26",
      title: "A passage",
      passage: "Apple trees grow here.",
      wordKeys: [wordKey],
      questions: [
        {
          id: "child",
          kind: "multipleChoice",
          prompt: "Which fruit?",
          options: ["apple", "pear", "plum", "peach"],
          answerIndex: 0,
          wordKey,
          senseId,
        },
      ],
    };
    state.sets = [
      {
        id: "set",
        setName: "水果練習",
        folderId: UNCATEGORIZED_FOLDER_ID,
        createdAt: "2026-09-26",
        updatedAt: "2026-09-26",
      },
    ];
    state.memberships.set = [{ wordKey, senseIds: [senseId] }];
    state.questions = [reading];
    let finishSave: (value: "saved") => void = () => undefined;
    const saveQuestion = vi.fn(
      () =>
        new Promise<"saved">((resolve) => {
          finishSave = resolve;
        }),
    );
    useLibraryStore.setState({ state, saveQuestion });

    const returnHref = "/app/sets/set?tab=questions";
    render(<ReadingEditor readingId="reading" returnHref={returnHref} />);
    fireEvent.click(await screen.findByRole("button", { name: "儲存題目" }));
    const saving = await screen.findByRole("button", { name: "正在儲存…" });
    expect(saving).toBeDisabled();
    expect(saveQuestion).toHaveBeenCalledOnce();
    await act(async () => finishSave("saved"));
    expect(push).toHaveBeenCalledWith(returnHref);
  });
});

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WordEditor } from "@/components/library/word-editor";
import { prepareWordEdit } from "@/src/lib/word-edit";
import { buildSenseId, normalizeWordKey } from "@/src/lib/library";
import { emptyLibraryState } from "@/src/lib/library-repository";
import { useLibraryStore } from "@/stores/library-store";
import type { LibraryState } from "@/types";

vi.mock("@/src/lib/library-repository", async (original) => ({ ...(await original<typeof import("@/src/lib/library-repository")>()), getLibraryRepository: () => ({ commit: async () => ({ changed: [], removed: [] }) }) }));
vi.mock("@/src/lib/sync-journal", () => ({ recordLocalChanges: async () => {}, untrackChanges: async () => {} }));
afterEach(cleanup);

function fixture(): LibraryState {
  const state = emptyLibraryState();
  state.sets = [{ id: "set", setName: "latest name", folderId: "folder", createdAt: "2026-09-12", updatedAt: "2026-09-12" }];
  for (const word of ["apple", "river"]) {
    const wordKey = normalizeWordKey(word), id = buildSenseId(wordKey, "n.", word);
    state.words[wordKey] = { wordKey, word, senses: [{ id, pos: "n.", meaningZh: word, examples: ["first", "second"] }], updatedAt: "2026-09-12" };
  }
  state.memberships.set = Object.values(state.words).map((word) => ({ wordKey: word.wordKey, senseIds: word.senses.map((sense) => sense.id) }));
  return state;
}

describe("single-word editing", () => {
  it("preserves current metadata and unrelated words and remaps only the edited sense", () => {
    const state = fixture(), key = normalizeWordKey("apple"), old = state.words[key].senses[0];
    const input = prepareWordEdit(state, "set", key, { word: "apple", senses: [{ id: old.id, pos: "n.", meaning: "蘋果", examples: ["new example"] }] });
    expect(input.setName).toBe("latest name");
    expect(input.words.find((word) => word.word === "river")?.examples).toEqual(["first", "second"]);
    expect(input.remaps).toEqual([{ oldWordKey: key, oldSenseId: old.id, newWordKey: key, newSenseId: buildSenseId(key, "n.", "蘋果") }]);
  });
  it("really deletes an example when saving unchanged word identity", async () => {
    const state = fixture(), key = normalizeWordKey("apple"), old = state.words[key].senses[0];
    useLibraryStore.setState({ state, status: "ready" });
    const input = prepareWordEdit(state, "set", key, { word: "apple", senses: [{ id: old.id, pos: old.pos, meaning: old.meaningZh, examples: ["second"] }] });
    expect(input.remaps).toEqual([]);
    await useLibraryStore.getState().saveSet(input);
    expect(useLibraryStore.getState().state.words[key].senses[0].examples).toEqual(["second"]);
    expect(useLibraryStore.getState().state.words[normalizeWordKey("river")].senses[0].examples).toEqual(["first", "second"]);
  });
  it("saves separately editable examples and leaves the original preview untouched", async () => {
    const value = { word: "apple", senses: [{ id: "a", pos: "n.", meaning: "蘋果", examples: ["first", "second"] }] }, save = vi.fn();
    render(<WordEditor value={value} onSave={save} onCancel={() => {}} />);
    fireEvent.click(screen.getAllByRole("button", { name: "刪除此例句" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "新增例句" }));
    fireEvent.change(screen.getByLabelText("例句 2"), { target: { value: "third" } });
    fireEvent.click(screen.getByRole("button", { name: "儲存此單字" }));
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(save.mock.calls[0][0].senses[0].examples).toEqual(["second", "third"]);
    expect(value.senses[0].examples).toEqual(["first", "second"]);
  });
});

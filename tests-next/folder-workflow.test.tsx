import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SetFolderPicker } from "@/components/library/set-folder-picker";
import { UNCATEGORIZED_FOLDER_ID } from "@/src/lib/folders";
import type { VocabFolder } from "@/types";

const timestamp = "2026-01-01T00:00:00.000Z";
const folders: VocabFolder[] = [
  {
    id: UNCATEGORIZED_FOLDER_ID,
    name: "未分類",
    order: -1,
    createdAt: timestamp,
    updatedAt: timestamp,
  },
  {
    id: "school",
    name: "學校",
    order: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  },
  {
    id: "english",
    name: "英文",
    parentId: "school",
    order: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  },
];

afterEach(() => {
  cleanup();
});

describe("folder workflow", () => {
  it("shows nested destinations with their hierarchy", () => {
    render(
      <SetFolderPicker
        folders={folders}
        onChange={() => undefined}
        value="english"
      />,
    );

    expect(screen.getByRole("combobox", { name: "資料夾" })).toHaveTextContent(
      "— 英文",
    );
  });
});

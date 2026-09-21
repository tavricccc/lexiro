"use client";

import type { VocabFolder } from "@/types";

import type { SelectOption } from "@/components/ui/select-field";
import { ListPicker, ListSection } from "@/components/ui/list";
import { t } from "@/lib/i18n";
import {
  buildFolderOptions,
  UNCATEGORIZED_FOLDER_ID,
} from "@/src/lib/folders";

export function buildSetFolderOptions(folders: VocabFolder[]): SelectOption[] {
  return [
    { label: t("library.uncategorized"), value: UNCATEGORIZED_FOLDER_ID },
    ...buildFolderOptions(folders)
      .filter((folder) => folder.id !== UNCATEGORIZED_FOLDER_ID)
      .map((folder) => ({ label: folder.label, value: folder.id })),
  ];
}

/** The shared destination picker for creating, moving, and renaming a set. */
export function SetFolderPicker({
  disabled,
  folders,
  onChange,
  value,
}: {
  disabled?: boolean;
  folders: VocabFolder[];
  onChange: (folderId: string) => void;
  value: string;
}) {
  return (
    <ListSection>
      <ListPicker
        disabled={disabled}
        label={t("setEditor.folder")}
        onChange={onChange}
        options={buildSetFolderOptions(folders)}
        value={value}
      />
    </ListSection>
  );
}

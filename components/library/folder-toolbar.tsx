"use client";

import type { VocabFolder } from "@/types";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { t } from "@/lib/i18n";
import {
  buildFolderOptions,
  collectFolderIds,
  UNCATEGORIZED_FOLDER_ID,
} from "@/src/lib/folders";

type Panel = "none" | "create" | "rename";

/** Radix rejects an empty option value, so the library root gets a sentinel. */
const ROOT_VALUE = "__root__";

/**
 * The path line doubles as the folder toolbar. Creating, renaming, moving and
 * deleting all happen where the path is shown, so there is one place to look
 * for "what can I do with this folder" instead of a menu somewhere else.
 */
export function FolderToolbar({
  breadcrumbs,
  currentFolder,
  folders,
  onCreate,
  onDelete,
  onMove,
  onOpen,
  onRename,
}: {
  breadcrumbs: VocabFolder[];
  currentFolder?: VocabFolder;
  folders: VocabFolder[];
  onCreate: (name: string) => Promise<unknown>;
  onDelete: () => void;
  onMove: (parentId?: string) => Promise<unknown>;
  onOpen: (folderId?: string) => void;
  onRename: (name: string) => Promise<unknown>;
}) {
  const [panel, setPanel] = useState<Panel>("none");
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  const open = (next: Panel) => {
    setPanel(next);
    setError("");
    setValue(next === "rename" ? (currentFolder?.name ?? "") : "");
  };

  const submit = async () => {
    if (!value.trim()) return;
    try {
      await (panel === "rename" ? onRename(value) : onCreate(value));
      setPanel("none");
      setValue("");
    } catch {
      setError(t("library.folderNameConflict"));
    }
  };

  const moveOptions = currentFolder
    ? [
        { label: t("library.rootFolder"), value: ROOT_VALUE },
        ...buildFolderOptions(folders)
          .filter(
            (folder) =>
              folder.id !== UNCATEGORIZED_FOLDER_ID &&
              !collectFolderIds(folders, currentFolder.id).has(folder.id),
          )
          .map((folder) => ({ label: folder.label, value: folder.id })),
      ]
    : [];

  return (
    <div className="border-b pb-4">
      <div className="flex items-center gap-2">
        <nav
          aria-label={t("library.folderPath")}
          className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto"
        >
          <Crumb
            active={!currentFolder}
            label={t("library.rootName")}
            onClick={() => onOpen(undefined)}
          />
          {breadcrumbs.map((folder, index) => (
            <span className="flex shrink-0 items-center" key={folder.id}>
              <Icons.open
                aria-hidden
                className="size-3.5 text-muted-foreground"
              />
              <Crumb
                active={index === breadcrumbs.length - 1}
                label={folder.name}
                onClick={() => onOpen(folder.id)}
              />
            </span>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-1">
          {currentFolder && (
            <>
              <Button
                aria-label={t("library.renameFolder")}
                onClick={() => open(panel === "rename" ? "none" : "rename")}
                size="icon"
                type="button"
                variant="ghost"
              >
                <Icons.edit />
              </Button>
              <Button
                aria-label={t("library.deleteFolder")}
                onClick={onDelete}
                size="icon"
                type="button"
                variant="ghost"
              >
                <Icons.delete />
              </Button>
            </>
          )}
          <Button
            onClick={() => open(panel === "create" ? "none" : "create")}
            size="sm"
            type="button"
            variant="ghost"
          >
            <Icons.create />
            <span className="hidden sm:inline">{t("library.newFolder")}</span>
          </Button>
        </div>
      </div>

      {panel !== "none" && (
        <div className="mt-3 rounded-[var(--radius-card)] bg-[var(--surface-inset)] p-3">
          <form
            className="flex max-w-md gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <Input
              autoFocus
              onChange={(event) => setValue(event.target.value)}
              placeholder={t("library.folderName")}
              value={value}
            />
            <Button size="sm" type="submit">
              <Icons.success />
              {t(panel === "rename" ? "common.confirm" : "library.create")}
            </Button>
            <Button
              onClick={() => setPanel("none")}
              size="sm"
              type="button"
              variant="ghost"
            >
              {t("common.cancel")}
            </Button>
          </form>

          {panel === "rename" && currentFolder && (
            <SelectField
              className="mt-3 max-w-md"
              label={t("library.moveFolder")}
              onValueChange={(next) => {
                void onMove(next === ROOT_VALUE ? undefined : next).catch(() =>
                  setError(t("library.folderNameConflict")),
                );
              }}
              options={moveOptions}
              value={currentFolder.parentId ?? ROOT_VALUE}
            />
          )}

          {error && (
            <p className="mt-2 text-xs text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Crumb({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-current={active ? "page" : undefined}
      className={
        active
          ? "whitespace-nowrap rounded-md px-2 py-1.5 text-sm font-medium text-foreground"
          : "whitespace-nowrap rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground"
      }
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

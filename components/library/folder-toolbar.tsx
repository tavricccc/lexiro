"use client";

import type { VocabFolder } from "@/types";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { Menu, type MenuAction } from "@/components/ui/menu";
import { SelectField } from "@/components/ui/select-field";
import { t } from "@/lib/i18n";
import {
  buildFolderOptions,
  collectFolderIds,
  UNCATEGORIZED_FOLDER_ID,
} from "@/src/lib/folders";

type Panel = "none" | "create" | "rename" | "move";

/** Radix rejects an empty option value, so the library root gets a sentinel. */
const ROOT_VALUE = "__root__";

/**
 * The path line says where you are; one menu beside it says what you can do
 * here. Folder chores are not why anyone opens this screen, so creating,
 * renaming, moving and deleting are all one press away rather than four buttons
 * wide — which also stops a destructive action from sitting permanently next to
 * a harmless one.
 */
export function FolderToolbar({
  actions: extraActions = [],
  breadcrumbs,
  currentFolder,
  folders,
  onCreate,
  onDelete,
  onMove,
  onOpen,
  onRename,
}: {
  /** Page-level actions that act on the folder you are standing in. */
  actions?: MenuAction[];
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

  const actions: MenuAction[] = [
    {
      icon: Icons.create,
      label: t("library.newFolder"),
      onSelect: () => open("create"),
    },
    ...(currentFolder
      ? ([
          {
            icon: Icons.edit,
            label: t("library.renameFolder"),
            onSelect: () => open("rename"),
          },
          {
            icon: Icons.folder,
            label: t("library.moveFolder"),
            onSelect: () => open("move"),
          },
          {
            icon: Icons.delete,
            label: t("library.deleteFolder"),
            onSelect: onDelete,
            tone: "destructive",
          },
        ] satisfies MenuAction[])
      : []),
    ...extraActions,
  ];

  return (
    <div className="rule-b pb-4">
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

        <Menu actions={actions} />
      </div>

      {panel !== "none" && (
        <div className="t-panel-reveal mt-3 rounded-[var(--radius-card)] bg-[var(--surface-inset)] p-3">
          {panel === "move" && currentFolder ? (
            <div className="flex max-w-md flex-wrap items-end gap-2">
              <SelectField
                className="min-w-0 flex-1"
                label={t("library.moveFolder")}
                onValueChange={(next) => {
                  void onMove(next === ROOT_VALUE ? undefined : next)
                    .then(() => setPanel("none"))
                    .catch(() => setError(t("library.folderNameConflict")));
                }}
                options={moveOptions}
                value={currentFolder.parentId ?? ROOT_VALUE}
              />
              <Button
                onClick={() => setPanel("none")}
                size="sm"
                type="button"
                variant="ghost"
              >
                {t("common.cancel")}
              </Button>
            </div>
          ) : (
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

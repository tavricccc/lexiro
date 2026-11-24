import { Button as SwiftButton, Divider, Menu } from "@expo/ui/swift-ui";
import { Fragment, useMemo } from "react";

import { newFolder } from "@/components/library/folder-actions";
import { MenuRow } from "@/components/ui/list";
import type { Folder } from "@/core/contract";
import { folderTree, type FolderTree } from "@/lib/folders";
import { haptics } from "@/lib/haptics";

/** The library's top level, where a set lives when it is in no folder. */
export const LIBRARY_ROOT = "我的單字";

/**
 * Picks where something goes in the folder tree, the way the library is
 * really laid out: 我的單字 at the top, and a folder with folders inside opens
 * as a submenu of them. With `canCreate`, each level can make a new folder
 * there, which is then picked.
 */
export function FolderPickerRow({
  folders,
  value,
  onChange,
  canCreate = false,
  disabled,
}: {
  folders: Folder[];
  value: string | null;
  onChange: (folderId: string | null) => void;
  canCreate?: boolean;
  disabled?: boolean;
}) {
  const tree = useMemo(() => folderTree(folders), [folders]);
  const current = tree.get(value) ? value : null;
  const pick = (folderId: string | null) => {
    haptics.select();
    onChange(folderId);
  };

  return (
    <MenuRow
      title="位置"
      icon="folder"
      detail={current ? tree.path(current) : LIBRARY_ROOT}
      disabled={disabled}
    >
      <SwiftButton
        label={LIBRARY_ROOT}
        systemImage={current === null ? "checkmark" : "books.vertical"}
        onPress={() => pick(null)}
      />
      <Divider />
      <Level tree={tree} parentId={null} current={current} pick={pick} canCreate={canCreate} />
    </MenuRow>
  );
}

function Level({
  tree,
  parentId,
  current,
  pick,
  canCreate,
}: {
  tree: FolderTree;
  parentId: string | null;
  current: string | null;
  pick: (folderId: string | null) => void;
  canCreate: boolean;
}) {
  const children = tree.children(parentId);
  return (
    <>
      {children.map((folder) => {
        const inner = tree.children(folder.id);
        const here = current === folder.id;
        // A folder with nothing inside is picked straight away; one with
        // folders inside opens on them, with itself as the first choice.
        if (!inner.length && !canCreate)
          return (
            <SwiftButton
              key={folder.id}
              label={folder.name}
              systemImage={here ? "checkmark" : "folder"}
              onPress={() => pick(folder.id)}
            />
          );
        const holdsCurrent = current !== null && !here && tree.within(folder.id).has(current);
        return (
          <Menu
            key={folder.id}
            label={folder.name}
            systemImage={here || holdsCurrent ? "folder.fill" : "folder"}
          >
            <SwiftButton
              label={`放在「${folder.name}」`}
              systemImage={here ? "checkmark" : "tray.and.arrow.down"}
              onPress={() => pick(folder.id)}
            />
            {inner.length ? <Divider /> : null}
            <Level
              tree={tree}
              parentId={folder.id}
              current={current}
              pick={pick}
              canCreate={canCreate}
            />
          </Menu>
        );
      })}
      {canCreate ? (
        <Fragment>
          {children.length ? <Divider /> : null}
          <SwiftButton
            label="新增資料夾…"
            systemImage="folder.badge.plus"
            onPress={() => newFolder(parentId, children.length, (folder) => pick(folder.id))}
          />
        </Fragment>
      ) : null}
    </>
  );
}

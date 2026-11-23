import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";

import { newFolder } from "@/components/library/folder-actions";
import { Loaded, Screen } from "@/components/ui/layout";
import { CheckRow, ListGroup } from "@/components/ui/list";
import { barButton, SheetHeader } from "@/components/ui/sheet-header";
import { errorMessage } from "@/data/api";
import { updateFolder, updateSet } from "@/data/library";
import { useOnline } from "@/data/network";
import { useLibrary } from "@/data/queries";
import { folderTree } from "@/lib/folders";
import { haptics } from "@/lib/haptics";
import { toast } from "@/platform/toast";

/** Picks the folder a set or folder moves into. */
export default function MoveScreen() {
  const params = useLocalSearchParams<{ set?: string; folder?: string }>();
  const library = useLibrary();
  const online = useOnline();
  const [busy, setBusy] = useState(false);
  const tree = useMemo(() => folderTree(library.data?.folders ?? []), [library.data?.folders]);

  const set = library.data?.sets.find((entry) => entry.id === params.set);
  const folder = tree.get(params.folder ?? null);
  const name = set?.name ?? folder?.name ?? "";
  const wanted = set ? set.folderId : (folder?.parentId ?? null);
  const current = tree.get(wanted) ? wanted : null;
  // A folder can't go inside itself or anything below it.
  const blocked = folder ? tree.within(folder.id) : new Set<string>();

  const moveTo = async (target: string | null) => {
    if (target === current) {
      router.back();
      return;
    }
    setBusy(true);
    try {
      if (set) await updateSet(set, { folderId: target });
      else if (folder) await updateFolder(folder, { parentId: target });
      haptics.success();
      router.back();
    } catch (reason) {
      haptics.error();
      toast.error(errorMessage(reason));
      setBusy(false);
    }
  };

  return (
    <>
      <SheetHeader
        title={name ? `移動「${name}」` : "移動"}
        items={[
          barButton(
            "新增資料夾",
            "folder.badge.plus",
            () => newFolder(null, tree.children(null).length),
            { disabled: !online },
          ),
        ]}
      />
      <Screen>
        <Loaded query={library}>
          {() => (
            <ListGroup>
              <CheckRow
                title="我的單字"
                icon="books.vertical"
                checked={current === null}
                disabled={busy || !online}
                onPress={() => void moveTo(null)}
              />
              {tree.flat
                .filter((entry) => !blocked.has(entry.folder.id))
                .map(({ folder: entry, depth }) => (
                  <CheckRow
                    key={entry.id}
                    title={entry.name}
                    icon="folder"
                    leading={<View style={{ width: (depth + 1) * 16 }} />}
                    checked={current === entry.id}
                    disabled={busy || !online}
                    onPress={() => void moveTo(entry.id)}
                  />
                ))}
            </ListGroup>
          )}
        </Loaded>
      </Screen>
    </>
  );
}

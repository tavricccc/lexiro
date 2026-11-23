import { router } from "expo-router";
import { Alert } from "react-native";

import type { Folder, SetSummary } from "@/core/contract";
import { errorMessage } from "@/data/api";
import { createFolder, deleteFolder, deleteSet, updateFolder } from "@/data/library";
import { haptics } from "@/lib/haptics";
import { toast } from "@/platform/toast";

const run = (action: Promise<unknown>, done?: () => void) =>
  action
    .then(() => {
      haptics.success();
      done?.();
    })
    .catch((reason) => {
      haptics.error();
      toast.error(errorMessage(reason));
    });

function askName(title: string, confirm: string, initial: string, save: (name: string) => void) {
  Alert.prompt(
    title,
    undefined,
    [
      { text: "取消", style: "cancel" },
      {
        text: confirm,
        onPress: (text?: string) => {
          const name = text?.trim().slice(0, 80);
          if (name && name !== initial) save(name);
        },
      },
    ],
    "plain-text",
    initial,
  );
}

export const newFolder = (parentId: string | null, order: number) =>
  askName("新增資料夾", "新增", "", (name) => void run(createFolder({ name, parentId, order })));

export const renameFolder = (folder: Folder) =>
  askName("重新命名資料夾", "儲存", folder.name, (name) => void run(updateFolder(folder, { name })));

export function removeFolder(folder: Folder, done?: () => void) {
  haptics.warning();
  Alert.alert(`刪除「${folder.name}」？`, "裡面的單字集和資料夾會移到上一層，不會被刪除。", [
    { text: "取消", style: "cancel" },
    {
      text: "刪除",
      style: "destructive",
      onPress: () => void run(deleteFolder(folder.id), done),
    },
  ]);
}

export function removeSet(set: SetSummary) {
  haptics.warning();
  Alert.alert(
    `刪除「${set.name}」？`,
    `${set.wordCount} 個單字和 ${set.questionCount} 題會一起刪除，無法復原。`,
    [
      { text: "取消", style: "cancel" },
      {
        text: "刪除",
        style: "destructive",
        onPress: () => void run(deleteSet(set.id), () => toast.success(`已刪除「${set.name}」`)),
      },
    ],
  );
}

/** Opens a set in the library, putting away the sheets over it. */
export const openSet = (setId: string) =>
  router.dismissTo({ pathname: "/library/[setId]", params: { setId } }, { withAnchor: true });

export const moveItem = (item: { set: string } | { folder: string }) =>
  router.push({ pathname: "/sets/move", params: item });

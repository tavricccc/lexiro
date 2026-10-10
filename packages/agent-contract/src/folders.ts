import { z } from "zod";
import { canonicalHash } from "@/src/lib/hash";
import { collectFolderIds, UNCATEGORIZED_FOLDER_ID } from "@/src/lib/folders";
import type { VocabFolder } from "@/types";
import type { AgentFolderMutation, AgentFolderMutationResult } from "./public";
export { UNCATEGORIZED_FOLDER_ID };
const text = z.string().trim().min(1).max(200);
const actionSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("create_folder"), name: text, parentId: text.optional() }),
  z.strictObject({ type: z.literal("update_folder"), folderId: text, name: text.optional(), parentId: text.nullable().optional() }),
  z.strictObject({ type: z.literal("delete_folder"), folderId: text }),
]);
export function agentFoldersRevision(folders: VocabFolder[]) {
  return canonicalHash([...folders].sort((a, b) => a.id.localeCompare(b.id)));
}
export function mutateAgentFolders(
  folders: VocabFolder[], value: AgentFolderMutation, newFolderId: string,
  occupiedFolderIds: string[],
): AgentFolderMutationResult {
  const action = actionSchema.parse(value), now = new Date().toISOString();
  const next = structuredClone(folders);
  let folder: VocabFolder | null;
  if (action.type === "create_folder") {
    folder = { id: newFolderId, name: action.name, ...(action.parentId ? { parentId: action.parentId } : {}), order: next.length, createdAt: now, updatedAt: now };
    next.push(folder);
  } else {
    const current = next.find(f => f.id === action.folderId);
    if (!current || current.id === UNCATEGORIZED_FOLDER_ID) throw new Error("找不到可編輯的資料夾");
    if (action.type === "delete_folder") {
      if (occupiedFolderIds.includes(current.id) || next.some(f => f.parentId === current.id)) throw new Error("資料夾仍有內容，請先移出或明確刪除單字集及子資料夾");
      next.splice(next.indexOf(current), 1); folder = null;
    } else {
      if (action.name !== undefined) current.name = action.name;
      if (action.parentId !== undefined) {
        if (action.parentId) current.parentId = action.parentId;
        else delete current.parentId;
      }
      current.updatedAt = now; folder = current;
    }
  }
  if (folder) {
    if (folder.parentId && (!next.some(f => f.id === folder!.parentId) || folder.parentId === UNCATEGORIZED_FOLDER_ID)) throw new Error("父資料夾不存在或不能作為父層");
    if (folder.parentId && collectFolderIds(folders, folder.id).has(folder.parentId)) throw new Error("資料夾不能移入自己或子資料夾");
    if (next.some(f => f.id !== folder!.id && f.parentId === folder!.parentId && f.name.trim().toLocaleLowerCase() === folder!.name.trim().toLocaleLowerCase())) throw new Error("同一層已有同名資料夾");
  }
  return { folders: next, folder, revision: agentFoldersRevision(next) };
}

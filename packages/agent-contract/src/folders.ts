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
    if (!current || current.id === UNCATEGORIZED_FOLDER_ID) throw new Error(`Folder ${action.folderId} not found or not editable (the uncategorized folder cannot be changed)`);
    if (action.type === "delete_folder") {
      if (occupiedFolderIds.includes(current.id) || next.some(f => f.parentId === current.id)) throw new Error("Folder is not empty; move or delete its sets and subfolders first");
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
    if (folder.parentId && (!next.some(f => f.id === folder!.parentId) || folder.parentId === UNCATEGORIZED_FOLDER_ID)) throw new Error(`parentId ${folder.parentId} does not exist or cannot be a parent`);
    if (folder.parentId && collectFolderIds(folders, folder.id).has(folder.parentId)) throw new Error("A folder cannot be moved into itself or its own subfolder");
    if (next.some(f => f.id !== folder!.id && f.parentId === folder!.parentId && f.name.trim().toLocaleLowerCase() === folder!.name.trim().toLocaleLowerCase())) throw new Error(`A folder named "${folder.name}" already exists at this level`);
  }
  return { folders: next, folder, revision: agentFoldersRevision(next) };
}

import type { Folder, FolderInput, QuestionInput, QuestionReport, SetContent, SetInput, SetSummary, Word, WordInput } from "@lexiro/contract";
import { api } from "./api";
import { invalidate, keys, queryClient } from "./queries";

const path = (setId: string, rest = "") => `/sets/${encodeURIComponent(setId)}${rest}`;

export async function createSet(input: SetInput): Promise<SetSummary> {
  const set = await api<SetSummary>("/sets", { method: "POST", json: input });
  await invalidate();
  return set;
}
export async function updateSet(set: SetSummary, change: Partial<SetInput>): Promise<SetSummary> {
  const { name, folderId, hue, icon, order } = { ...set, ...change };
  const saved = await api<SetSummary>(path(set.id), { method: "PUT", json: { name, folderId, hue, icon, order } });
  await invalidate(set.id);
  return saved;
}
export async function deleteSet(setId: string) {
  await api(path(setId), { method: "DELETE" });
  queryClient.removeQueries({ queryKey: keys.set(setId) });
  await invalidate();
}
export async function orderSets(ids: string[]) {
  await api("/sets/order", { method: "POST", json: { ids } });
  await invalidate();
}

export async function createFolder(input: FolderInput): Promise<Folder> {
  const folder = await api<Folder>("/folders", { method: "POST", json: input });
  await invalidate();
  return folder;
}
export async function updateFolder(folder: Folder, change: Partial<FolderInput>) {
  const { name, parentId, order } = { ...folder, ...change };
  await api(`/folders/${encodeURIComponent(folder.id)}`, { method: "PUT", json: { name, parentId, order } });
  await invalidate();
}
export async function deleteFolder(folderId: string) {
  await api(`/folders/${encodeURIComponent(folderId)}`, { method: "DELETE" });
  await invalidate();
}

export async function putWords(setId: string, words: WordInput[]): Promise<{ words: Word[]; removedQuestionIds: string[] }> {
  const result = await api<{ words: Word[]; removedQuestionIds: string[] }>(path(setId, "/words"), { method: "POST", json: { words } });
  await invalidate(setId);
  return result;
}
export async function deleteWords(setId: string, ids: string[]) {
  const result = await api<{ removedQuestionIds: string[] }>(path(setId, "/words/delete"), { method: "POST", json: { ids } });
  await invalidate(setId);
  return result;
}
export async function copyWords(setId: string, ids: string[], to: string) {
  await api(path(setId, "/words/copy"), { method: "POST", json: { ids, to } });
  await invalidate(to);
}

/** Stars or unstars at once on screen; the change is undone if the Worker refuses. */
export async function starWords(setId: string, ids: string[], starred: boolean) {
  const key = keys.set(setId);
  const previous = queryClient.getQueryData<SetContent>(key);
  queryClient.setQueryData<SetContent>(key, (content) => content && {
    ...content,
    words: content.words.map((word) => (ids.includes(word.id) ? { ...word, starred } : word)),
  });
  try {
    await api(path(setId, "/words/star"), { method: "POST", json: { ids, starred } });
  } catch (reason) {
    queryClient.setQueryData(key, previous);
    throw reason;
  }
}

export async function putQuestions(setId: string, questions: QuestionInput[]): Promise<QuestionReport> {
  const report = await api<QuestionReport>(path(setId, "/questions"), { method: "POST", json: { questions, mode: "atomic" } });
  await invalidate(setId);
  return report;
}
export async function deleteQuestions(setId: string, ids: string[]) {
  await api(path(setId, "/questions/delete"), { method: "POST", json: { ids } });
  await invalidate(setId);
}

export async function shareSet(setId: string): Promise<string> {
  const { id } = await api<{ id: string }>(path(setId, "/share"), { method: "POST" });
  return id;
}
export const shareOf = (setId: string) => api<{ id: string | null }>(path(setId, "/share")).then((result) => result.id);
export async function unshareSet(setId: string) {
  await api(path(setId, "/share"), { method: "DELETE" });
}
export const sharedSet = (shareId: string) => api<SetContent>(`/shared/${encodeURIComponent(shareId)}`, { auth: false });

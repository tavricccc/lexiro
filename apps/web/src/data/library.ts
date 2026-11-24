import { compareWords, type Folder, type FolderInput, type QuestionInput, type QuestionReport, type SetContent, type SetInput, type SetSummary, type Word, type WordInput } from "@lexiro/contract";
import { api } from "./api";
import { afterWrite, keys, queryClient } from "./queries";

const path = (setId: string, rest = "") => `/sets/${encodeURIComponent(setId)}${rest}`;

/**
 * Sends a write. `patch` applies the Worker's answer to the cached sets named
 * in `setIds`; afterwards the library index syncs, and those sets take their
 * new summary without being downloaded again when this device's write was the
 * only one. Without a patch the caller waits for the synced index and sets.
 */
async function write<T>(url: string, init: Parameters<typeof api>[1], setIds: string[] = [], patch?: (result: T) => void): Promise<T> {
  let own = false;
  const result = await api<T>(url, { ...init, onRevision: (value) => (own = value) });
  if (patch) {
    patch(result);
    afterWrite(setIds, own);
  } else {
    await afterWrite([], own, true);
  }
  return result;
}

const patchSet = (setId: string, change: (content: SetContent) => SetContent) =>
  queryClient.setQueryData<SetContent>(keys.set(setId), (content) => content && change(content));

const withoutQuestions = (content: SetContent, ids: string[]) =>
  ids.length ? { ...content, questions: content.questions.filter((question) => !ids.includes(question.id)) } : content;

export const createSet = (input: SetInput) => write<SetSummary>("/sets", { method: "POST", json: input });
export function updateSet(set: SetSummary, change: Partial<SetInput>): Promise<SetSummary> {
  const { name, folderId, hue, icon, order } = { ...set, ...change };
  return write<SetSummary>(path(set.id), { method: "PUT", json: { name, folderId, hue, icon, order } }, [set.id], (saved) =>
    patchSet(set.id, (content) => ({ ...content, set: { ...content.set, ...saved } })));
}
export async function deleteSet(setId: string) {
  await write(path(setId), { method: "DELETE" });
  queryClient.removeQueries({ queryKey: keys.set(setId) });
}
export async function orderSets(ids: string[]) {
  await write("/sets/order", { method: "POST", json: { ids } });
}

export const createFolder = (input: FolderInput) => write<Folder>("/folders", { method: "POST", json: input });
export async function updateFolder(folder: Folder, change: Partial<FolderInput>) {
  const { name, parentId, order } = { ...folder, ...change };
  await write(`/folders/${encodeURIComponent(folder.id)}`, { method: "PUT", json: { name, parentId, order } });
}
export async function deleteFolder(folderId: string) {
  await write(`/folders/${encodeURIComponent(folderId)}`, { method: "DELETE" });
}

export const putWords = (setId: string, words: WordInput[]) =>
  write<{ words: Word[]; removedQuestionIds: string[] }>(path(setId, "/words"), { method: "POST", json: { words } }, [setId], (result) =>
    patchSet(setId, (content) => {
      const saved = new Set(result.words.map((word) => word.id));
      const all = [...content.words.filter((word) => !saved.has(word.id)), ...result.words].sort((a, b) => compareWords(a.word, b.word));
      return withoutQuestions({ ...content, words: all }, result.removedQuestionIds);
    }));
export const deleteWords = (setId: string, ids: string[]) =>
  write<{ removedQuestionIds: string[] }>(path(setId, "/words/delete"), { method: "POST", json: { ids } }, [setId], (result) =>
    patchSet(setId, (content) => withoutQuestions({ ...content, words: content.words.filter((word) => !ids.includes(word.id)) }, result.removedQuestionIds)));
/** The target set is refetched by the sync that follows. */
export async function copyWords(setId: string, ids: string[], to: string) {
  await write(path(setId, "/words/copy"), { method: "POST", json: { ids, to } }, [to]);
}

/** Stars or unstars at once on screen; the change is undone if the Worker refuses. */
export async function starWords(setId: string, ids: string[], starred: boolean) {
  const key = keys.set(setId);
  const previous = queryClient.getQueryData<SetContent>(key);
  const previousStarred = queryClient.getQueryData<{ words: Word[] }>(keys.starred);
  patchSet(setId, (content) => ({ ...content, words: content.words.map((word) => (ids.includes(word.id) ? { ...word, starred } : word)) }));
  if (previousStarred) {
    const added = starred ? (previous?.words ?? []).filter((word) => ids.includes(word.id)).map((word) => ({ ...word, starred })) : [];
    queryClient.setQueryData(keys.starred, { words: [...previousStarred.words.filter((word) => !ids.includes(word.id)), ...added] });
  }
  try {
    await write(path(setId, "/words/star"), { method: "POST", json: { ids, starred } }, [setId], () => {});
  } catch (reason) {
    queryClient.setQueryData(key, previous);
    if (previousStarred) queryClient.setQueryData(keys.starred, previousStarred);
    throw reason;
  }
}

/** The Worker reports only ids, so the set is refetched by the sync that follows. */
export const putQuestions = (setId: string, questions: QuestionInput[]) =>
  write<QuestionReport>(path(setId, "/questions"), { method: "POST", json: { questions, mode: "atomic" } }, [setId]);
export async function deleteQuestions(setId: string, ids: string[]) {
  await write(path(setId, "/questions/delete"), { method: "POST", json: { ids } }, [setId], () => patchSet(setId, (content) => withoutQuestions(content, ids)));
}

export async function shareSet(setId: string): Promise<string> {
  const { id } = await api<{ id: string }>(path(setId, "/share"), { method: "POST" });
  return id;
}
export const shareOf = (setId: string) => api<{ id: string | null }>(path(setId, "/share")).then((result) => result.id);
export async function unshareSet(setId: string) {
  await api(path(setId, "/share"), { method: "DELETE" });
}
export const sharedSet = (code: string) => api<SetContent>(`/shared/${encodeURIComponent(code)}`, { auth: false });
/** Copies a shared set into this account. */
export const addShared = (code: string, folderId: string | null) =>
  write<SetSummary>(`/shared/${encodeURIComponent(code)}/add`, { method: "POST", json: { folderId } });

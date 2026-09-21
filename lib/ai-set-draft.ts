const KEY = "lexiro.ai-set-draft";

export interface AiSetDraft {
  folderId: string;
  name: string;
  sources: string;
}

export function readAiSetDraft(): AiSetDraft | null {
  const raw = window.sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<AiSetDraft>;
    return typeof value.folderId === "string" &&
      typeof value.name === "string" &&
      typeof value.sources === "string"
      ? { folderId: value.folderId, name: value.name, sources: value.sources }
      : null;
  } catch {
    return null;
  }
}

export function writeAiSetDraft(draft: AiSetDraft) {
  window.sessionStorage.setItem(KEY, JSON.stringify(draft));
}

export function clearAiSetDraft() {
  window.sessionStorage.removeItem(KEY);
}

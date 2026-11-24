import { compareWords, type Folder, type SetSummary } from "@lexiro/contract";

/** The library's top level, where a set lives when it is in no folder. */
export const LIBRARY_ROOT = "我的單字";

/** Sets in a folder in the order the person placed them, the rest A to Z after. */
export function orderedSets(sets: SetSummary[]): SetSummary[] {
  return [...sets].sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || compareWords(a.name, b.name));
}

/** The folder tree: which folder really contains which, and how to name and walk it. */
export interface FolderTree {
  /** Subfolders directly inside a folder (`null` is the top level), in order. */
  children: (parentId: string | null) => Folder[];
  get: (id: string | null) => Folder | undefined;
  /** The folder and everything below it. */
  within: (id: string) => Set<string>;
  /** "Parent / Child" */
  path: (id: string) => string;
  /** Ancestors from the top down, ending with this folder. */
  trail: (id: string) => Folder[];
  /** Every folder, parents before their children. */
  flat: { folder: Folder; depth: number }[];
}

export function folderTree(folders: Folder[]): FolderTree {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const trace = (id: string) => {
    const out: Folder[] = [];
    const seen = new Set<string>();
    let at = byId.get(id);
    while (at && !seen.has(at.id)) {
      seen.add(at.id);
      out.unshift(at);
      at = at.parentId ? byId.get(at.parentId) : undefined;
    }
    return { out, loops: Boolean(at) };
  };
  // A folder whose parent is gone, or that loops back to itself, shows at the top
  // level so it can never become unreachable.
  const parentOf = (folder: Folder) =>
    folder.parentId && byId.has(folder.parentId) && !trace(folder.id).loops
      ? folder.parentId
      : null;

  const groups = new Map<string | null, Folder[]>();
  for (const folder of folders) {
    const parent = parentOf(folder);
    groups.set(parent, [...(groups.get(parent) ?? []), folder]);
  }
  for (const group of groups.values())
    group.sort((a, b) => a.order - b.order || compareWords(a.name, b.name));

  const children = (parentId: string | null) => groups.get(parentId) ?? [];
  const flat: FolderTree["flat"] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const folder of children(parentId)) {
      flat.push({ folder, depth });
      walk(folder.id, depth + 1);
    }
  };
  walk(null, 0);

  const within = (id: string) => {
    const out = new Set([id]);
    const add = (parent: string) => {
      for (const child of children(parent)) {
        out.add(child.id);
        add(child.id);
      }
    };
    add(id);
    return out;
  };

  return {
    children,
    get: (id) => (id ? byId.get(id) : undefined),
    within,
    trail: (id) => trace(id).out,
    path: (id) => trace(id).out.map((folder) => folder.name).join(" / "),
    flat,
  };
}

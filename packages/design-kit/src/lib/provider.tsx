import * as React from "react";

/**
 * What the primitives need from the app around them, and nothing more: how a
 * path becomes an address, how to move to it without a reload, how to step
 * back, and the few words they say themselves.
 *
 * The kit never knows the router. A path router (React Router, TanStack…) and
 * a hash router both fit the same three functions; see `hashNavigation`.
 */
export interface Navigation {
  /** The address an anchor shows for an in-app path (`/settings` → `#/settings` for hash routing). */
  href(path: string): string;
  /** Move in place. Return false to let the browser follow the link itself. */
  navigate(path: string, options?: { replace?: boolean }): boolean;
  /** Back to `parent`: a step back in history when that is where the user came from. Defaults to replacing with `parent`. */
  back?(parent: string): void;
}

export interface Labels {
  cancel: string;
  close: string;
  save: string;
  saved: string;
  review: string;
  discard: string;
  reload: string;
  pending(count: number): string;
  zoom(alt: string): string;
  resetField(field: string): string;
}

export const labelsZhTW: Labels = {
  cancel: "取消",
  close: "關閉",
  save: "儲存",
  saved: "已儲存",
  review: "檢視變更",
  discard: "捨棄",
  reload: "捨棄草稿並重新載入",
  pending: (count) => `${count} 項未儲存的變更`,
  zoom: (alt) => `放大圖片：${alt}`,
  resetField: (field) => `將「${field}」重置為預設值`,
};

export const labelsEn: Labels = {
  cancel: "Cancel",
  close: "Close",
  save: "Save",
  saved: "Saved",
  review: "Review changes",
  discard: "Discard",
  reload: "Discard draft and reload",
  pending: (count) => `${count} unsaved changes`,
  zoom: (alt) => `Enlarge image: ${alt}`,
  resetField: (field) => `Reset ${field} to default`,
};

/** Without a provider, links are ordinary links: every click loads a page. */
const documentNavigation: Navigation = {
  href: (path) => path,
  navigate: () => false,
};

interface Kit {
  navigation: Navigation;
  labels: Labels;
}

const KitContext = React.createContext<Kit>({ navigation: documentNavigation, labels: labelsZhTW });

export function DesignKitProvider({
  children,
  labels = labelsZhTW,
  navigation = documentNavigation,
}: {
  children: React.ReactNode;
  labels?: Partial<Labels>;
  navigation?: Navigation;
}) {
  const value = React.useMemo(() => ({ navigation, labels: { ...labelsZhTW, ...labels } }), [navigation, labels]);
  return <KitContext.Provider value={value}>{children}</KitContext.Provider>;
}

export function useNavigation() {
  return React.useContext(KitContext).navigation;
}

export function useLabels() {
  return React.useContext(KitContext).labels;
}

/**
 * Hash routing (`#/settings`), so a server needs no fallback route. Back steps
 * through history only when the parent is the screen visited just before.
 * Create it once, at startup.
 */
export function hashNavigation(): Navigation & { read(): string } {
  const read = () => location.hash.replace(/^#/, "") || "/";
  const visited: string[] = [read()];
  window.addEventListener("hashchange", () => {
    const now = read();
    if (visited.at(-2) === now) visited.pop();
    else visited.push(now);
  });
  const navigate = (path: string, { replace = false }: { replace?: boolean } = {}) => {
    if (!path.startsWith("/")) return false;
    if (replace) location.replace(`#${path}`);
    else location.hash = path;
    return true;
  };
  return {
    read,
    href: (path) => (path.startsWith("/") ? `#${path}` : path),
    navigate,
    back: (parent) => {
      if (visited.at(-2) === parent) history.back();
      else navigate(parent, { replace: true });
    },
  };
}

import { ALL_FOLDER_ID } from "@/src/lib/folders";
import { LIBRARY_QUESTIONS_HREF } from "./routes";

/** List state travels with its return destination, including nested folders. */
export function libraryBrowseHref(folderId: string, query: string) {
  const params = new URLSearchParams();
  if (folderId !== ALL_FOLDER_ID) params.set("folderId", folderId);
  if (query) params.set("q", query);
  return queryHref("/app/library", params);
}

export function questionBrowseHref(
  query: string,
  kind: string,
  difficulty: string,
) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (kind !== "all") params.set("kind", kind);
  if (difficulty !== "all") params.set("difficulty", difficulty);
  return queryHref(LIBRARY_QUESTIONS_HREF, params);
}

export function withReturnTo(href: string, returnTo: string) {
  const [pathname, search = ""] = href.split("?");
  const params = new URLSearchParams(search);
  params.set("returnTo", returnTo);
  return queryHref(pathname, params);
}

export function readBrowseReturn(
  value: string | undefined,
): string | undefined {
  if (!value) return;
  // Return destinations are collection views, never external or editor URLs.
  if (
    /^\/app\/(?:library|questions|sets\/[^/?#\\]+)(?:\?|$)/.test(value) &&
    !value.includes("\\")
  )
    return value;
}

export function setBrowseHref(setId: string, tab: string, returnTo?: string) {
  const params = new URLSearchParams();
  if (tab !== "words") params.set("tab", tab);
  if (returnTo) params.set("returnTo", returnTo);
  return queryHref(`/app/sets/${setId}`, params);
}

function queryHref(pathname: string, params: URLSearchParams) {
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

/** Native replaceState keeps filtering immediate without adding Back entries. */
export function replaceBrowseHref(href: string) {
  if (
    window.location.pathname === href.split("?")[0] &&
    `${window.location.pathname}${window.location.search}` !== href
  )
    window.history.replaceState(null, "", href);
}

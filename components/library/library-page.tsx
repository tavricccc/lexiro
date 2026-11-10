import { Menu } from "@/components/ui/menu";
import Link from "@/components/ui/app-link";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { FolderToolbar } from "@/components/library/folder-toolbar";
import { StaggerItem, StaggerList } from "@/components/motion/stagger";
import {
  ContentTransition,
  StateTransition,
} from "@/components/motion/state-transition";
import { FolderRow, SetRow } from "@/components/library/library-rows";
import { useSetActions } from "@/components/library/set-actions";
import { SortableSetList } from "@/components/library/sortable-set-list";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Icons } from "@/components/ui/icons";
import { SearchField } from "@/components/ui/search-field";
import { RootPageHeader } from "@/components/root-page-header";
import { useAppRouter } from "@/lib/use-app-router";
import { EmptyState, ErrorState } from "@/components/ui/page-state";
import { LibraryListSkeleton } from "@/components/ui/workspace-skeleton";
import { t } from "@/lib/i18n";
import { useLibraryStore } from "@/stores/library-store";
import {
  ALL_FOLDER_ID,
  buildFolderBreadcrumbs,
  collectFolderIds,
  countDirectItems,
  UNCATEGORIZED_FOLDER_ID,
} from "@/src/lib/folders";
import { buildLibrarySetMetrics } from "@/src/lib/library-metrics";
import { createUniqueSetName } from "@/src/lib/set-name";
import { planSetReorder, sortSets } from "@/src/lib/set-order";
import { copySharedSet, readSetShare } from "@/src/lib/set-share";
import { setMatchesQuery } from "@/src/lib/library-search";
import { libraryBrowseHref, replaceBrowseHref } from "@/lib/browse-routes";

const NO_METRICS = { questionCount: 0, senseCount: 0 };

/** The Library is one place for browsing and organising saved word sets. */
export function LibraryPage({
  initialFolderId,
  initialQuery = "",
}: {
  initialFolderId?: string;
  initialQuery?: string;
}) {
  const router = useAppRouter();
  const { state, status, error } = useLibraryStore();
  const createFolder = useLibraryStore((store) => store.createFolder);
  const renameFolder = useLibraryStore((store) => store.renameFolder);
  const moveFolder = useLibraryStore((store) => store.moveFolder);
  const deleteFolder = useLibraryStore((store) => store.deleteFolder);
  const saveSet = useLibraryStore((store) => store.saveSet);
  const saveQuestion = useLibraryStore((store) => store.saveQuestion);

  const { actionsFor, dialogs: setDialogs } = useSetActions();
  const moveSet = useLibraryStore((store) => store.moveSet);
  const reorderSets = useLibraryStore((store) => store.reorderSets);
  const [reorderRequested, setReordering] = useState(false);
  const [hoverFolder, setHoverFolder] = useState<string | null>(null);
  const [query, setQuery] = useState(initialQuery);
  const [currentFolderId, setCurrentFolderId] = useState(
    initialFolderId ?? ALL_FOLDER_ID,
  );
  const [deleteFolderId, setDeleteFolderId] = useState<string | null>(null);
  const [_importing, setImporting] = useState(false);
  const importInput = useRef<HTMLInputElement>(null);

  const setMetrics = useMemo(() => buildLibrarySetMetrics(state), [state]);
  const currentFolder = state.folders.find(
    (folder) =>
      folder.id === currentFolderId && folder.id !== UNCATEGORIZED_FOLDER_ID,
  );
  useEffect(() => {
    if (
      status === "ready" &&
      currentFolderId !== ALL_FOLDER_ID &&
      !currentFolder
    )
      setCurrentFolderId(ALL_FOLDER_ID);
  }, [currentFolder, currentFolderId, status]);

  const breadcrumbs = useMemo(
    () => buildFolderBreadcrumbs(state.folders, currentFolder),
    [currentFolder, state.folders],
  );
  const childFolders = useMemo(
    () =>
      state.folders
        .filter(
          (folder) =>
            folder.id !== UNCATEGORIZED_FOLDER_ID &&
            folder.parentId === currentFolder?.id,
        )
        .toSorted((a, b) => a.order - b.order || a.name.localeCompare(b.name)),
    [currentFolder, state.folders],
  );

  const sets = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    const scope = currentFolder
      ? collectFolderIds(state.folders, currentFolder.id)
      : null;
    return sortSets(
      state.sets.filter((entry) => {
        // Searching looks through the whole subtree; browsing shows one level.
        const inLocation = needle
          ? !scope || scope.has(entry.folderId)
          : currentFolder
            ? entry.folderId === currentFolder.id
            : true;
        if (!inLocation) return false;
        if (!needle) return true;
        if (entry.setName.toLocaleLowerCase().includes(needle)) return true;
        return setMatchesQuery(state, entry.id, needle);
      }),
    );
  }, [currentFolder, query, state]);

  const importSet = async (file: File) => {
    setImporting(true);
    try {
      const payload = await readSetShare(file);
      const existingNames = new Set(state.sets.map((entry) => entry.setName));
      let lastFolderId = currentFolder?.id;
      for (const sharedSet of payload.sets) {
        const setName = createUniqueSetName(sharedSet.setName, existingNames);
        existingNames.add(setName);
        const imported = await copySharedSet(
          sharedSet,
          { folderId: currentFolder?.id, setName },
          { saveSet, saveQuestion },
        );
        lastFolderId = imported.folderId;
      }
      if (currentFolder && lastFolderId) setCurrentFolderId(lastFolderId);
      toast.success(t("library.importDone", { count: payload.sets.length }));
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason);
      toast.error(t("library.importFailed", { message }));
    } finally {
      setImporting(false);
    }
  };

  const openFolder = (folderId?: string) => {
    setCurrentFolderId(folderId ?? ALL_FOLDER_ID);
    setQuery("");
    setReordering(false);
  };

  // Drilling into a folder is a location, not a scroll position: it belongs in
  // the URL, so opening a set and coming back does not dump you at the root.
  useEffect(() => {
    if (status !== "ready") return;
    replaceBrowseHref(libraryBrowseHref(currentFolderId, query));
  }, [currentFolderId, query, status]);
  const browseHref = libraryBrowseHref(currentFolderId, query);
  const createHref = currentFolder
    ? `/app/sets/new?folderId=${encodeURIComponent(currentFolder.id)}`
    : "/app/sets/new";
  const searching = Boolean(query.trim());
  // Reordering works on one folder level, so a search leaves it.
  const canReorder = !searching && sets.length > 1;
  const reordering = reorderRequested && canReorder;
  const folderName = (folderId: string) =>
    state.folders.find((folder) => folder.id === folderId)?.name ?? "";
  const listEmpty =
    sets.length === 0 && (searching || childFolders.length === 0);
  // The identity the listing frame crossfades on. The listing itself is one
  // identity however its rows change: rows are handed over by the list, not by
  // the frame around it.
  const listingState =
    status === "ready"
      ? listEmpty
        ? searching
          ? "no-results"
          : "empty"
        : "listing"
      : status;
  const deleteTarget = state.folders.find(
    (entry) => entry.id === deleteFolderId,
  );

  return (
    <div className="library-workspace">
      <RootPageHeader
        title={t("redesign.library")}
        actions={
          <>
            <Button
              size="icon"
              variant="glass"
              aria-label={t("redesign.sort")}
              onClick={() => setReordering(!reordering)}
            >
              <Icons.reorder />
            </Button>
            <Menu
              label={t("redesign.add")}
              trigger={
                <Button size="icon" aria-label={t("redesign.add")}>
                  <Icons.create />
                </Button>
              }
              actions={[
                {
                  icon: Icons.create,
                  label: t("library.newSet"),
                  onSelect: () => {
                    router.push(createHref);
                  },
                },
                {
                  icon: Icons.folder,
                  label: t("redesign.newFolder"),
                  onSelect: () => {
                    document
                      .querySelector<HTMLButtonElement>("[data-create-folder]")
                      ?.click();
                  },
                },
                {
                  icon: Icons.import,
                  label: t("library.importSet"),
                  onSelect: () => importInput.current?.click(),
                },
              ]}
            />
          </>
        }
      />

      <>
        <input
          accept=".zip"
          aria-label={t("library.importSet")}
          hidden
          onChange={(event) => {
            const input = event.currentTarget;
            const file = input.files?.[0];
            if (file)
              void importSet(file).finally(() => {
                input.value = "";
              });
          }}
          ref={importInput}
          type="file"
        />

        <div className="library-toolbar">
          <FolderToolbar
            actions={
              canReorder && !reordering
                ? [
                    {
                      icon: Icons.reorder,
                      label: t("library.reorderSets"),
                      onSelect: () => setReordering(true),
                    },
                  ]
                : []
            }
            breadcrumbs={breadcrumbs}
            currentFolder={currentFolder}
            folders={state.folders}
            onCreate={(name) => createFolder(name, currentFolder?.id)}
            onDelete={() => setDeleteFolderId(currentFolder?.id ?? null)}
            onMove={(parentId) => moveFolder(currentFolderId, parentId)}
            onOpen={openFolder}
            onRename={(name) => renameFolder(currentFolderId, name)}
          />

          <SearchField
            className="mt-4"
            label={t("library.searchHere")}
            value={query}
            onValueChange={setQuery}
          />
        </div>

        {/* Loading, empty, filtered-empty and the listing itself all occupy the
            same frame, so one hands over to the next in place instead of the
            page jumping to whichever arrived. */}
        <StateTransition className="mt-5" identity={listingState}>
          <ContentTransition identity={listingState}>
            {status === "loading" && <LibraryListSkeleton />}
            {status === "error" && (
              <ErrorState
                error={t("library.migrationError", { message: error ?? "" })}
              />
            )}
            {status === "ready" && !listEmpty && (
              <div className="grid gap-5">
                {!searching && childFolders.length > 0 && (
                  <StaggerList className="flex flex-wrap gap-2"><StaggerItem><button type="button" className="pill" aria-pressed={!currentFolder} onClick={() => openFolder(ALL_FOLDER_ID)}><span className="text-base font-semibold">{t("redesign.all")}</span></button></StaggerItem>
                    {childFolders.map((folder) => (
                      <StaggerItem key={folder.id} className="max-w-full">
                        <FolderRow
                          folderId={folder.id}
                          highlighted={hoverFolder === folder.id}
                          itemCount={countDirectItems(
                            state.folders,
                            state.sets,
                            folder.id,
                          )}
                          name={folder.name}
                          onOpen={() => openFolder(folder.id)}
                        />
                      </StaggerItem>
                    ))}
                  </StaggerList>
                )}
                {sets.length > 0 &&
                  (reordering ? (
                    <div className="grid gap-3">
                      <div className="flex items-center gap-3 rounded-[var(--radius-control)] bg-[var(--brand-50)] px-4 py-2.5">
                        <p className="type-hint min-w-0 flex-1 text-muted-foreground">
                          {t("library.reorderHint")}
                        </p>
                        <Button
                          onClick={() => setReordering(false)}
                          size="sm"
                          type="button"
                        >
                          {t("library.reorderDone")}
                        </Button>
                      </div>
                      <SortableSetList
                        key={`${currentFolderId}:${sets.map((entry) => entry.id).join()}`}
                        metrics={(id) => setMetrics.get(id) ?? NO_METRICS}
                        onDropInFolder={(id, folderId) =>
                          void moveSet(id, folderId).then(() =>
                            toast.success(
                              t("library.movedToFolder", {
                                name: folderName(folderId),
                              }),
                            ),
                          )
                        }
                        onHoverFolder={setHoverFolder}
                        onReorder={(id, toIndex) =>
                          void reorderSets(planSetReorder(sets, id, toIndex))
                        }
                        sets={sets}
                      />
                    </div>
                  ) : (
                    <StaggerList className="library-set-grid">
                      {sets.map((entry) => (
                        <StaggerItem key={entry.id}>
                          <SetRow
                            actions={actionsFor(entry.id, { practice: true })}
                            id={entry.id}
                            name={entry.setName}
                            returnTo={browseHref}
                            {...(setMetrics.get(entry.id) ?? NO_METRICS)}
                          />
                        </StaggerItem>
                      ))}
      <Link className="dashed" href={createHref} style={{ marginTop: 20 }}>
        <Icons.create />
        {t("library.newSet")}
      </Link>
                    </StaggerList>
                  ))}
              </div>
            )}
            {status === "ready" && listEmpty && searching && (
              <EmptyState
                description={t("library.searchHint")}
                title={t("library.noResults")}
                variant="filtered"
                action={
                  <Button variant="outline" onClick={() => setQuery("")}>
                    <Icons.cancel />
                    {t("common.clearSearch")}
                  </Button>
                }
              />
            )}
            {status === "ready" && listEmpty && !searching && (
              <EmptyState
                description={t(
                  currentFolder
                    ? "library.emptyFolderDescription"
                    : "library.emptyDescription",
                )}
                headword="lexicon"
                pos="n."
                title={t(
                  currentFolder
                    ? "library.emptyFolderTitle"
                    : "library.emptyTitle",
                )}
              />
            )}
          </ContentTransition>
        </StateTransition>
      </>



      <ConfirmDialog
        confirmLabel={t("library.deleteFolder")}
        description={t("library.deleteFolderConfirm", {
          name: deleteTarget?.name ?? "",
          sets: deleteFolderId
            ? state.sets.filter((entry) =>
                collectFolderIds(state.folders, deleteFolderId).has(
                  entry.folderId,
                ),
              ).length
            : 0,
        })}
        onConfirm={async () => {
          if (deleteFolderId) await deleteFolder(deleteFolderId);
          setCurrentFolderId(ALL_FOLDER_ID);
        }}
        onOpenChange={(open) => {
          if (!open) setDeleteFolderId(null);
        }}
        open={Boolean(deleteFolderId)}
        title={t("library.deleteFolder")}
      />
      {setDialogs}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { FolderToolbar } from "@/components/library/folder-toolbar";
import { FolderRow, SetRow } from "@/components/library/library-rows";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Icons } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/page-state";
import { t } from "@/lib/i18n";
import { useLearningStore } from "@/stores/learning-store";
import { useLibraryStore } from "@/stores/library-store";
import {
  ALL_FOLDER_ID,
  buildFolderBreadcrumbs,
  collectFolderIds,
  countDirectItems,
  UNCATEGORIZED_FOLDER_ID,
} from "@/src/lib/folders";
import { buildQuestionId } from "@/src/lib/library";
import { buildLibrarySetMetrics } from "@/src/lib/library-metrics";
import { createUniqueSetName } from "@/src/lib/set-name";
import { readSetShare } from "@/src/lib/set-share";

const NO_METRICS = { due: 0, learned: 0, questionCount: 0, senseCount: 0 };

export function LibraryPage({ initialFolderId }: { initialFolderId?: string }) {
  const { state, status, error } = useLibraryStore();
  const createFolder = useLibraryStore((store) => store.createFolder);
  const renameFolder = useLibraryStore((store) => store.renameFolder);
  const moveFolder = useLibraryStore((store) => store.moveFolder);
  const deleteFolder = useLibraryStore((store) => store.deleteFolder);
  const saveSet = useLibraryStore((store) => store.saveSet);
  const saveQuestion = useLibraryStore((store) => store.saveQuestion);
  const cards = useLearningStore((store) => store.progress.cards);

  const [query, setQuery] = useState("");
  const [currentFolderId, setCurrentFolderId] = useState(
    initialFolderId ?? ALL_FOLDER_ID,
  );
  const [deleteFolderId, setDeleteFolderId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const setMetrics = useMemo(
    () => buildLibrarySetMetrics(state, cards),
    [cards, state],
  );
  const currentFolder = state.folders.find(
    (folder) =>
      folder.id === currentFolderId && folder.id !== UNCATEGORIZED_FOLDER_ID,
  );
  useEffect(() => {
    if (status === "ready" && currentFolderId !== ALL_FOLDER_ID && !currentFolder)
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
    return state.sets.filter((entry) => {
      // Searching looks through the whole subtree; browsing shows one level.
      const inLocation = needle
        ? !scope || scope.has(entry.folderId)
        : currentFolder
          ? entry.folderId === currentFolder.id
          : !entry.folderId ||
            entry.folderId === ALL_FOLDER_ID ||
            entry.folderId === UNCATEGORIZED_FOLDER_ID;
      if (!inLocation) return false;
      if (!needle) return true;
      if (entry.setName.toLocaleLowerCase().includes(needle)) return true;
      return (state.memberships[entry.id] ?? []).some((membership) => {
        const word = state.words[membership.wordKey];
        return (
          word?.word.toLocaleLowerCase().includes(needle) ||
          word?.senses.some(
            (sense) =>
              sense.meaningZh.includes(needle) ||
              sense.examples.some((example) =>
                example.toLocaleLowerCase().includes(needle),
              ),
          )
        );
      });
    });
  }, [currentFolder, query, state]);

  const importSet = async (file: File) => {
    setImporting(true);
    try {
      const payload = await readSetShare(file);
      const existingNames = new Set(state.sets.map((entry) => entry.setName));
      let lastFolderId = currentFolder?.id;
      for (const sharedSet of payload.sets) {
        const wordsByKey = new Map(
          sharedSet.words.map((word) => [word.wordKey, word]),
        );
        const drafts = sharedSet.memberships.flatMap((membership) => {
          const word = wordsByKey.get(membership.wordKey);
          if (!word) return [];
          return membership.senseIds.flatMap((senseId) => {
            const sense = word.senses.find((entry) => entry.id === senseId);
            return sense
              ? [
                  {
                    examples: sense.examples,
                    meaningZh: sense.meaningZh,
                    pos: sense.pos,
                    word: word.word,
                  },
                ]
              : [];
          });
        });
        const setName = createUniqueSetName(sharedSet.setName, existingNames);
        existingNames.add(setName);
        const imported = await saveSet({
          folderId: currentFolder?.id,
          setName,
          words: drafts,
        });
        lastFolderId = imported.folderId;
        for (const question of sharedSet.questions)
          await saveQuestion({ ...question, id: buildQuestionId() });
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
  };
  const createHref = currentFolder
    ? `/sets/new?folderId=${encodeURIComponent(currentFolder.id)}`
    : "/sets/new";
  const searching = Boolean(query.trim());
  const listEmpty = sets.length === 0 && (searching || childFolders.length === 0);
  const deleteTarget = state.folders.find(
    (entry) => entry.id === deleteFolderId,
  );

  return (
    <div>
      <PageHeader
        title={t("library.title")}
        description={t("library.description")}
        actions={
          <>
            <Button asChild variant="ghost">
              <label
                aria-disabled={importing}
                className={importing ? "cursor-wait opacity-60" : "cursor-pointer"}
              >
                <Icons.import />
                {t(importing ? "library.importing" : "library.importSet")}
                <input
                  accept=".zip"
                  className="sr-only"
                  disabled={importing}
                  onChange={(event) => {
                    const input = event.currentTarget;
                    const file = input.files?.[0];
                    if (file)
                      void importSet(file).finally(() => {
                        input.value = "";
                      });
                  }}
                  type="file"
                />
              </label>
            </Button>
            <Button asChild>
              <Link href={createHref}>
                <Icons.create />
                {t("library.newSet")}
              </Link>
            </Button>
          </>
        }
      />

      <FolderToolbar
        breadcrumbs={breadcrumbs}
        currentFolder={currentFolder}
        folders={state.folders}
        onCreate={(name) => createFolder(name, currentFolder?.id)}
        onDelete={() => setDeleteFolderId(currentFolder?.id ?? null)}
        onMove={(parentId) => moveFolder(currentFolderId, parentId)}
        onOpen={openFolder}
        onRename={(name) => renameFolder(currentFolderId, name)}
      />

      <label className="relative mt-4 block">
        <Icons.search
          aria-hidden
          className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          className="pl-10"
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("library.searchHere")}
          value={query}
        />
      </label>

      <div className="mt-5">
        {status === "loading" && <LoadingState />}
        {status === "error" && <ErrorState error={t("library.migrationError", { message: error ?? "" })} />}
        {status === "ready" && !listEmpty && (
          <div className="divide-y border-y">
            {!searching &&
              childFolders.map((folder) => (
                <FolderRow
                  itemCount={countDirectItems(
                    state.folders,
                    state.sets,
                    folder.id,
                  )}
                  key={folder.id}
                  name={folder.name}
                  onOpen={() => openFolder(folder.id)}
                />
              ))}
            {sets.map((entry) => (
              <SetRow
                key={entry.id}
                id={entry.id}
                name={entry.setName}
                {...(setMetrics.get(entry.id) ?? NO_METRICS)}
              />
            ))}
          </div>
        )}
        {status === "ready" && listEmpty && searching && (
          <EmptyState
            description={t("library.searchHint")}
            title={t("library.noResults")}
            variant="filtered"
          />
        )}
        {status === "ready" && listEmpty && !searching && (
          <EmptyState
            action={
              <Button asChild>
                <Link href={createHref}>
                  <Icons.create />
                  {t("library.newSet")}
                </Link>
              </Button>
            }
            description={t(
              currentFolder
                ? "library.emptyFolderDescription"
                : "library.emptyDescription",
            )}
            headword="lexicon"
            pos="n."
            title={t(
              currentFolder ? "library.emptyFolderTitle" : "library.emptyTitle",
            )}
          />
        )}
      </div>

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
          setDeleteFolderId(null);
        }}
        onOpenChange={(open) => {
          if (!open) setDeleteFolderId(null);
        }}
        open={Boolean(deleteFolderId)}
        title={t("library.deleteFolder")}
      />
    </div>
  );
}

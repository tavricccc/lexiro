import { useState } from "react";

import { SetMoveDialog } from "@/components/library/set-move-dialog";
import { ShareLinkDialog } from "@/components/library/share-link-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Icons } from "@/components/ui/icons";
import type { MenuAction } from "@/components/ui/menu";
import { t } from "@/lib/i18n";
import { useAppRouter as useRouter } from "@/lib/use-app-router";
import { createSetSharePayload, downloadSetShare } from "@/src/lib/set-share";
import { useLibraryStore } from "@/stores/library-store";

type SetDialog = "move" | "share" | "delete";

/**
 * What can be done to a set, shared by its page's menu and the library's
 * row menus, with one copy of each dialog however many rows offer them.
 */
export function useSetActions(onDeleted?: (setId: string) => void) {
  const router = useRouter();
  const { state, deleteSet, moveSet } = useLibraryStore();
  // The set stays named after its dialog closes, so the dialog can animate out.
  const [target, setTarget] = useState<{
    setId: string;
    dialog: SetDialog | null;
  } | null>(null);
  const open = (setId: string, dialog: SetDialog) =>
    setTarget({ setId, dialog });
  const close = () =>
    setTarget((current) => current && { ...current, dialog: null });

  const actionsFor = (
    setId: string,
    { practice = false }: { practice?: boolean } = {},
  ): MenuAction[] => [
    ...(practice
      ? [
          {
            icon: Icons.start,
            label: t("setDetail.start"),
            onSelect: () => router.push(`/app/practice?set=${setId}`),
          },
        ]
      : []),
    {
      icon: Icons.edit,
      label: t("setDetail.edit"),
      onSelect: () => router.push(`/app/sets/${setId}/settings`),
    },
    {
      icon: Icons.folder,
      label: t("library.moveSet"),
      onSelect: () => open(setId, "move"),
    },
    {
      icon: Icons.shareLink,
      label: t("setDetail.shareLink"),
      onSelect: () => open(setId, "share"),
    },
    {
      icon: Icons.export,
      label: t("setDetail.share"),
      onSelect: () => downloadSetShare(createSetSharePayload(state, setId)),
    },
    {
      icon: Icons.delete,
      label: t("setDetail.delete"),
      onSelect: () => open(setId, "delete"),
      tone: "destructive",
    },
  ];

  const current = target
    ? state.sets.find((entry) => entry.id === target.setId)
    : undefined;
  const dialogs = current ? (
    <>
      <SetMoveDialog
        currentFolderId={current.folderId}
        folders={state.folders}
        onMove={(folderId) => moveSet(current.id, folderId)}
        onOpenChange={(next) => !next && close()}
        open={target?.dialog === "move"}
        setName={current.setName}
      />
      <ShareLinkDialog
        open={target?.dialog === "share"}
        onOpenChange={(next) => !next && close()}
        setId={current.id}
      />
      <ConfirmDialog
        confirmLabel={t("setDetail.delete")}
        description={t("setDetail.deleteConfirm", { name: current.setName })}
        onConfirm={async () => {
          await deleteSet(current.id);
          onDeleted?.(current.id);
        }}
        onOpenChange={(next) => !next && close()}
        open={target?.dialog === "delete"}
        title={t("setDetail.delete")}
      />
    </>
  ) : null;

  return { actionsFor, dialogs };
}

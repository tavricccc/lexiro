import { useMemo, useState } from "react";
import { Books, Check, FolderSimple, FolderSimplePlus } from "@phosphor-icons/react";
import { toast } from "sonner";
import type { Folder, SetSummary } from "@lexiro/contract";
import { Button, ConfirmDialog, Input, ListGroup, Sheet, cn, type ActionStatus } from "design-kit";
import { errorMessage } from "@/data/api";
import { createFolder, deleteFolder, deleteSet, updateFolder, updateSet } from "@/data/library";
import { useLibrary } from "@/data/queries";
import { useOnline } from "@/ui/offline-banner";
import { LIBRARY_ROOT, folderTree } from "./folders";

/** Creates a folder inside `parentId` or renames an existing one. */
export function FolderNameDialog({
  mode,
  onClose,
  onCreated,
}: {
  mode: { type: "create"; parentId: string | null; order: number; parentName?: string } | { type: "rename"; folder: Folder } | null;
  onClose: () => void;
  onCreated?: (folder: Folder) => void;
}) {
  return (
    <FolderNameDialogInner
      key={mode ? (mode.type === "rename" ? mode.folder.id : `new:${mode.parentId ?? "root"}`) : "closed"}
      mode={mode}
      onClose={onClose}
      onCreated={onCreated}
    />
  );
}

function FolderNameDialogInner({
  mode,
  onClose,
  onCreated,
}: {
  mode: { type: "create"; parentId: string | null; order: number; parentName?: string } | { type: "rename"; folder: Folder } | null;
  onClose: () => void;
  onCreated?: (folder: Folder) => void;
}) {
  const [name, setName] = useState(mode?.type === "rename" ? mode.folder.name : "");
  const [status, setStatus] = useState<ActionStatus>("idle");

  const submit = async () => {
    if (!mode || status !== "idle") return;
    const trimmed = name.trim().slice(0, 80);
    if (!trimmed) return;
    if (mode.type === "rename" && trimmed === mode.folder.name) {
      onClose();
      return;
    }
    setStatus("loading");
    try {
      if (mode.type === "create") {
        const created = await createFolder({ name: trimmed, parentId: mode.parentId, order: mode.order });
        onCreated?.(created);
      } else {
        await updateFolder(mode.folder, { name: trimmed });
      }
      onClose();
    } catch (reason) {
      toast.error(errorMessage(reason));
      setStatus("idle");
    }
  };

  return (
    <ConfirmDialog
      confirmLabel={mode?.type === "rename" ? "儲存" : "新增"}
      description={mode?.type === "create" && mode.parentName ? `位置：${mode.parentName}` : undefined}
      onConfirm={() => void submit()}
      onOpenChange={(next) => { if (!next) onClose(); }}
      open={mode !== null}
      status={status}
      title={mode?.type === "rename" ? "重新命名資料夾" : "新增資料夾"}
    >
      <form onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <Input
          aria-label="資料夾名稱"
          autoFocus
          maxLength={80}
          onChange={(event) => setName(event.target.value)}
          placeholder="例如：高三上、多益"
          value={name}
        />
      </form>
    </ConfirmDialog>
  );
}

export function DeleteFolderDialog({
  folder,
  onClose,
  onDeleted,
}: {
  folder: Folder | null;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const [status, setStatus] = useState<ActionStatus>("idle");
  return (
    <ConfirmDialog
      confirmLabel="刪除"
      description="裡面的單字集和資料夾會移到上一層，不會被刪除。"
      onConfirm={async () => {
        if (!folder) return;
        setStatus("loading");
        try {
          await deleteFolder(folder.id);
          onClose();
          onDeleted?.();
        } catch (reason) {
          toast.error(errorMessage(reason));
        } finally {
          setStatus("idle");
        }
      }}
      onOpenChange={(next) => { if (!next) onClose(); }}
      open={folder !== null}
      status={status}
      title={`刪除「${folder?.name ?? ""}」？`}
      tone="danger"
    />
  );
}

export function DeleteSetDialog({
  set,
  onClose,
  onDeleted,
}: {
  set: SetSummary | null;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const [status, setStatus] = useState<ActionStatus>("idle");
  return (
    <ConfirmDialog
      confirmLabel="刪除"
      description={set ? `${set.wordCount} 個單字和 ${set.questionCount} 題會一起刪除，無法復原。` : undefined}
      onConfirm={async () => {
        if (!set) return;
        setStatus("loading");
        try {
          await deleteSet(set.id);
          toast.success(`已刪除「${set.name}」`);
          onClose();
          onDeleted?.();
        } catch (reason) {
          toast.error(errorMessage(reason));
        } finally {
          setStatus("idle");
        }
      }}
      onOpenChange={(next) => { if (!next) onClose(); }}
      open={set !== null}
      status={status}
      title={`刪除「${set?.name ?? ""}」？`}
      tone="danger"
    />
  );
}

export type MoveTarget = { type: "set"; set: SetSummary } | { type: "folder"; folder: Folder };

/** Picks the folder a set or folder moves into, mirroring the real folder tree. */
export function MoveSheet({
  target,
  onClose,
}: {
  target: MoveTarget | null;
  onClose: () => void;
}) {
  const library = useLibrary();
  const online = useOnline();
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState<{ type: "create"; parentId: string | null; order: number; parentName?: string } | null>(null);
  const tree = useMemo(() => folderTree(library.data?.folders ?? []), [library.data?.folders]);

  const name = target ? (target.type === "set" ? target.set.name : target.folder.name) : "";
  const wanted = target ? (target.type === "set" ? target.set.folderId : target.folder.parentId) : null;
  const current = tree.get(wanted) ? wanted : null;
  // A folder can't go inside itself or anything below it.
  const blocked = useMemo(
    () => (target?.type === "folder" ? tree.within(target.folder.id) : new Set<string>()),
    [target, tree],
  );

  const moveTo = async (destination: string | null) => {
    if (!target) return;
    if (destination === current) {
      onClose();
      return;
    }
    setBusy(true);
    try {
      if (target.type === "set") await updateSet(target.set, { folderId: destination });
      else await updateFolder(target.folder, { parentId: destination });
      toast.success(destination ? `已移至「${tree.path(destination)}」` : `已移至「${LIBRARY_ROOT}」`);
      onClose();
    } catch (reason) {
      toast.error(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Sheet onOpenChange={(next) => { if (!next && !busy) onClose(); }} open={target !== null} title={name ? `移動「${name}」` : "移動"}>
        <div className="grid gap-4">
          <ListGroup label="選擇目標資料夾">
            <TreeRow
              checked={current === null}
              depth={0}
              disabled={busy || !online}
              icon={<Books weight="duotone" />}
              label={LIBRARY_ROOT}
              onSelect={() => void moveTo(null)}
            />
            {tree.flat
              .filter((entry) => !blocked.has(entry.folder.id))
              .map(({ folder: entry, depth }) => (
                <TreeRow
                  checked={current === entry.id}
                  depth={depth + 1}
                  disabled={busy || !online}
                  icon={<FolderSimple weight="fill" />}
                  key={entry.id}
                  label={entry.name}
                  onSelect={() => void moveTo(entry.id)}
                />
              ))}
          </ListGroup>
          <Button
            className="justify-self-start"
            disabled={busy || !online}
            onClick={() => setCreating({ type: "create", parentId: null, order: tree.children(null).length })}
            size="sm"
            variant="ghost"
          >
            <FolderSimplePlus weight="bold" />新增資料夾…
          </Button>
        </div>
      </Sheet>
      <FolderNameDialog
        mode={creating}
        onClose={() => setCreating(null)}
      />
    </>
  );
}

export function TreeRow({
  label,
  icon,
  depth,
  checked,
  disabled,
  onSelect,
  trailing,
}: {
  label: string;
  icon: React.ReactNode;
  depth: number;
  checked: boolean;
  disabled?: boolean;
  onSelect: () => void;
  trailing?: React.ReactNode;
}) {
  return (
    <li className="flex items-center">
      <button
        aria-pressed={checked}
        className="flex min-h-12 min-w-0 flex-1 items-center gap-3 py-2.5 pr-4 text-left outline-none transition-colors duration-[var(--motion-control)] hover:bg-surface-raised active:bg-surface-pressed focus-visible:bg-surface-raised disabled:pointer-events-none disabled:opacity-40"
        disabled={disabled}
        onClick={onSelect}
        style={{ paddingLeft: `${1 + depth * 1.125}rem` }}
        type="button"
      >
        <span aria-hidden className={cn("shrink-0 [&_svg]:size-5", checked ? "text-accent-ink" : "text-ink-muted")}>
          {icon}
        </span>
        <span className={cn("min-w-0 flex-1 truncate text-base", checked && "font-semibold text-accent-ink")}>{label}</span>
        {checked ? <Check aria-hidden className="mark-in size-4 shrink-0 text-accent-ink" weight="bold" /> : null}
      </button>
      {trailing ? <span className="pr-2">{trailing}</span> : null}
    </li>
  );
}

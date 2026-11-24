import { useState } from "react";
import { PencilSimple, Plus, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button, ConfirmDialog, Input, ListGroup, ListRow, Sheet } from "design-kit";
import type { Folder } from "@lexiro/contract";
import { errorMessage } from "@/data/api";
import { createFolder, deleteFolder, updateFolder } from "@/data/library";
import { useLibrary } from "@/data/queries";

/** Adding, renaming and removing folders, in one sheet. */
export function FolderSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const library = useLibrary();
  const folders = library.data?.folders ?? [];
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Folder | null>(null);
  const [removing, setRemoving] = useState<Folder | null>(null);
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try { await action(); } catch (reason) { toast.error(errorMessage(reason)); } finally { setBusy(false); }
  };
  return (
    <Sheet onOpenChange={onOpenChange} open={open} title="資料夾">
      <div className="grid gap-5">
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const value = name.trim();
            if (!value) return;
            void run(async () => { await createFolder({ name: value, order: folders.length }); setName(""); });
          }}
        >
          <Input aria-label="新資料夾名稱" maxLength={80} onChange={(event) => setName(event.target.value)} placeholder="新資料夾名稱" value={name} />
          <Button aria-label="新增資料夾" disabled={!name.trim() || busy} size="icon" type="submit" variant="primary"><Plus weight="bold" /></Button>
        </form>
        {folders.length ? (
          <ListGroup footer="刪除資料夾不會刪除裡面的單字集，它們會移到上一層。" label="資料夾">
            {folders.map((folder) => (
              <ListRow
                key={folder.id}
                label={folder.name}
                trailing={
                  <span className="flex gap-1">
                    <Button aria-label={`重新命名 ${folder.name}`} onClick={() => setEditing(folder)} size="icon-sm" variant="ghost"><PencilSimple /></Button>
                    <Button aria-label={`刪除 ${folder.name}`} onClick={() => setRemoving(folder)} size="icon-sm" variant="ghost"><Trash /></Button>
                  </span>
                }
              />
            ))}
          </ListGroup>
        ) : <p className="text-center text-[0.9375rem] text-ink-muted">還沒有資料夾</p>}
      </div>
      <RenameDialog folder={editing} key={editing?.id ?? "none"} onClose={() => setEditing(null)} onSave={(folder, value) => run(() => updateFolder(folder, { name: value }))} />
      <ConfirmDialog
        confirmLabel="刪除"
        description="裡面的單字集會移到上一層，不會被刪除。"
        onConfirm={() => { const folder = removing; setRemoving(null); if (folder) void run(() => deleteFolder(folder.id)); }}
        onOpenChange={(next) => !next && setRemoving(null)}
        open={removing !== null}
        title={`刪除「${removing?.name ?? ""}」？`}
        tone="danger"
      />
    </Sheet>
  );
}

function RenameDialog({ folder, onClose, onSave }: { folder: Folder | null; onClose: () => void; onSave: (folder: Folder, name: string) => Promise<void> }) {
  const [value, setValue] = useState(folder?.name ?? "");
  return (
    <ConfirmDialog
      confirmLabel="儲存"
      onConfirm={() => { if (folder && value.trim()) void onSave(folder, value.trim()); onClose(); }}
      onOpenChange={(next) => { if (!next) onClose(); }}
      open={folder !== null}
      title="重新命名資料夾"
    >
      <Input aria-label="資料夾名稱" autoFocus maxLength={80} onChange={(event) => setValue(event.target.value)} value={value} />
    </ConfirmDialog>
  );
}

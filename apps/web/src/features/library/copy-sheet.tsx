import { useMemo, useState } from "react";
import { FolderSimplePlus, Plus } from "@phosphor-icons/react";
import { toast } from "sonner";
import type { Folder, SetSummary } from "@lexiro/contract";
import { Button, Field, Input, ListGroup, ListRow, Reveal, Sheet, useLast, type ActionStatus } from "design-kit";
import { errorMessage } from "@/data/api";
import { copyWords, createSet } from "@/data/library";
import { useLibrary } from "@/data/queries";
import { useOnline } from "@/ui/offline-banner";
import { SetIcon } from "@/ui/set-icon";
import { FolderPickerField } from "./folder-picker";
import { LIBRARY_ROOT, folderTree, orderedSets } from "./folders";

/** Picks the set the selected words are copied into, or makes a new one on the spot. */
export function CopySheet({ fromSetId, ids, open, onOpenChange, onDone }: {
  fromSetId: string;
  ids: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const library = useLibrary();
  const online = useOnline();
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);

  const folders = library.data?.folders;
  const tree = useMemo(() => folderTree(folders ?? []), [folders]);
  const source = library.data?.sets.find((set) => set.id === fromSetId);

  // The other sets, laid out as the library is: 我的單字 first, then each
  // folder in tree order, named by its path.
  const groups = useMemo(() => {
    const others = (library.data?.sets ?? []).filter((set) => set.id !== fromSetId);
    const inFolder = (folderId: string | null) =>
      orderedSets(
        others.filter((set) => (tree.get(set.folderId) ? set.folderId : null) === folderId),
      );
    return [
      { key: "root", title: LIBRARY_ROOT, sets: inFolder(null) },
      ...tree.flat.map(({ folder: entry }) => ({
        key: entry.id,
        title: tree.path(entry.id),
        sets: inFolder(entry.id),
      })),
    ].filter((group) => group.sets.length > 0);
  }, [library.data?.sets, fromSetId, tree]);

  const copyTo = async (set: Pick<SetSummary, "id" | "name">) => {
    await copyWords(fromSetId, ids, set.id);
    toast.success(`已複製到「${set.name}」`);
    onOpenChange(false);
    setCreating(false);
    onDone();
  };

  return (
    <Sheet
      description="同樣拼法的單字會合併，補上缺少的意思。"
      onOpenChange={(next) => { onOpenChange(next); if (!next) setCreating(false); }}
      open={open}
      title={`複製 ${useLast(open ? ids.length : null) ?? ids.length} 個單字到…`}
    >
      <div className="grid gap-4">
        <div className="grid grid-cols-[minmax(0,1fr)]">
          <Reveal open={!creating}>
            <Button disabled={!online} onClick={() => setCreating(true)} variant="secondary">
              <Plus weight="bold" />建立新單字集
            </Button>
          </Reveal>
          <Reveal open={creating}>
            <NewTarget
              defaultFolderId={source?.folderId ?? null}
              folders={folders ?? []}
              onCancel={() => setCreating(false)}
              onCreated={copyTo}
              online={online}
            />
          </Reveal>
        </div>
        {groups.map((group) => (
          <ListGroup key={group.key} title={group.title}>
            {group.sets.map((set) => (
              <ListRow
                detail={`${set.wordCount} 個單字`}
                disabled={busy || !online}
                icon={<SetIcon className="size-8 [&_svg]:size-4" icon={set.icon} />}
                key={set.id}
                label={set.name}
                onClick={async () => {
                  setBusy(true);
                  try { await copyTo(set); } catch (reason) { toast.error(errorMessage(reason)); } finally { setBusy(false); }
                }}
              />
            ))}
          </ListGroup>
        ))}
      </div>
    </Sheet>
  );
}

/** A name and a place in the real folder tree, then create and copy in one go. */
function NewTarget({ folders, defaultFolderId, online, onCancel, onCreated }: {
  folders: Folder[];
  defaultFolderId: string | null;
  online: boolean;
  onCancel: () => void;
  onCreated: (set: SetSummary) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [folderId, setFolderId] = useState<string | null>(defaultFolderId);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<ActionStatus>("idle");
  const tree = useMemo(() => folderTree(folders), [folders]);

  const submit = async () => {
    if (!name.trim()) return setError("請輸入單字集名稱");
    setStatus("loading");
    try {
      const targetFolder = tree.get(folderId) ? folderId : null;
      await onCreated(await createSet({ name: name.trim(), folderId: targetFolder }));
    } catch (reason) {
      setStatus("idle");
      setError(errorMessage(reason));
    }
  };

  return (
    <form className="grid gap-4 rounded-tile border border-line p-4" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      <Field error={error} label="新單字集名稱">
        {({ id, describedBy, invalid }) => (
          <Input
            aria-describedby={describedBy}
            aria-invalid={invalid}
            autoFocus
            id={id}
            maxLength={200}
            onChange={(event) => { setName(event.target.value); setError(""); }}
            placeholder="例如：第三課複習"
            value={name}
          />
        )}
      </Field>
      <FolderPickerField
        canCreate={online}
        disabled={status !== "idle" || !online}
        folders={folders}
        onChange={setFolderId}
        value={folderId}
      />
      <div className="flex justify-end gap-2">
        <Button disabled={status !== "idle"} onClick={onCancel} type="button" variant="ghost">取消</Button>
        <Button disabled={!online} status={status} type="submit" variant="primary"><FolderSimplePlus weight="bold" />建立並複製</Button>
      </div>
    </form>
  );
}

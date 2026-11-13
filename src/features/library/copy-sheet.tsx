import { useState } from "react";
import { FolderSimplePlus, Plus } from "@phosphor-icons/react";
import { toast } from "sonner";
import type { SetSummary } from "@lexiro/contract";
import { Button, Field, Input, ListGroup, ListRow, Sheet, type ActionStatus } from "design-kit";
import { errorMessage } from "@/data/api";
import { copyWords, createFolder, createSet } from "@/data/library";
import { useLibrary } from "@/data/queries";
import { LabeledSelect } from "@/ui/labeled-select";
import { SetIcon } from "@/ui/set-icon";
import { orderedSets } from "./library-page";

const NO_FOLDER = "none";
const NEW_FOLDER = "new";

/** Picks the set the selected words are copied into, or makes a new one on the spot. */
export function CopySheet({ fromSetId, ids, open, onOpenChange, onDone }: {
  fromSetId: string;
  ids: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const library = useLibrary();
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const targets = orderedSets((library.data?.sets ?? []).filter((set) => set.id !== fromSetId));
  const copyTo = async (set: Pick<SetSummary, "id" | "name">) => {
    await copyWords(fromSetId, ids, set.id);
    toast.success(`已複製到「${set.name}」`);
    onOpenChange(false);
    setCreating(false);
    onDone();
  };
  return (
    <Sheet description="同樣拼法的單字會合併，補上缺少的意思。" onOpenChange={(next) => { onOpenChange(next); if (!next) setCreating(false); }} open={open} title={`複製 ${ids.length} 個單字到…`}>
      <div className="grid gap-4">
        {creating ? (
          <NewTarget folders={library.data?.folders ?? []} onCancel={() => setCreating(false)} onCreated={copyTo} />
        ) : (
          <Button className="justify-self-start" onClick={() => setCreating(true)} variant="secondary"><Plus weight="bold" />新單字集</Button>
        )}
        {targets.length ? (
          <ListGroup label="單字集">
            {targets.map((set) => (
              <ListRow
                detail={`${set.wordCount} 個單字`}
                disabled={busy}
                icon={<SetIcon className="size-8 [&_svg]:size-4" hue={set.hue} icon={set.icon} />}
                key={set.id}
                label={set.name}
                onClick={async () => {
                  setBusy(true);
                  try { await copyTo(set); } catch (reason) { toast.error(errorMessage(reason)); } finally { setBusy(false); }
                }}
              />
            ))}
          </ListGroup>
        ) : null}
      </div>
    </Sheet>
  );
}

/** A name, a folder (existing, none, or a new one named here), then create and copy in one go. */
function NewTarget({ folders, onCancel, onCreated }: {
  folders: { id: string; name: string }[];
  onCancel: () => void;
  onCreated: (set: SetSummary) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [folder, setFolder] = useState(NO_FOLDER);
  const [folderName, setFolderName] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState<ActionStatus>("idle");
  const submit = async () => {
    if (!name.trim()) return setError("請輸入單字集名稱");
    if (folder === NEW_FOLDER && !folderName.trim()) return setError("請輸入資料夾名稱");
    setStatus("loading");
    try {
      const folderId = folder === NEW_FOLDER ? (await createFolder({ name: folderName.trim() })).id : folder === NO_FOLDER ? null : folder;
      await onCreated(await createSet({ name: name.trim(), folderId }));
    } catch (reason) {
      setStatus("idle");
      setError(errorMessage(reason));
    }
  };
  return (
    <form className="grid gap-4 rounded-tile border border-line p-4" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      <Field error={error} label="新單字集名稱">
        {({ id, describedBy, invalid }) => <Input aria-describedby={describedBy} aria-invalid={invalid} autoFocus id={id} maxLength={200} onChange={(event) => { setName(event.target.value); setError(""); }} value={name} />}
      </Field>
      <LabeledSelect
        label="放在資料夾"
        onChange={setFolder}
        options={[{ value: NO_FOLDER, label: "不放資料夾" }, ...folders.map((entry) => ({ value: entry.id, label: entry.name })), { value: NEW_FOLDER, label: "新資料夾…" }]}
        value={folder}
      />
      {folder === NEW_FOLDER ? (
        <Field label="新資料夾名稱">
          {({ id }) => <Input id={id} maxLength={80} onChange={(event) => { setFolderName(event.target.value); setError(""); }} placeholder="例如：高三上" value={folderName} />}
        </Field>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button onClick={onCancel} type="button" variant="ghost">取消</Button>
        <Button status={status} type="submit" variant="primary"><FolderSimplePlus weight="bold" />建立並複製</Button>
      </div>
    </form>
  );
}

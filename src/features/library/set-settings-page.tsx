import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Trash } from "@phosphor-icons/react";
import { toast } from "sonner";
import type { SetContent } from "@lexiro/contract";
import { Button, ConfirmDialog, ListGroup, ListRow } from "design-kit";
import { errorMessage } from "@/data/api";
import { deleteSet, updateSet } from "@/data/library";
import { useLibrary, useSet } from "@/data/queries";
import { useOnline } from "@/ui/offline-banner";
import { Loaded, Page } from "@/ui/page";
import { SetForm, type SetFormValue } from "./set-form";

export default function SetSettingsPage() {
  const { setId = "" } = useParams();
  const content = useSet(setId);
  return (
    <Page back={{ href: `/app/sets/${setId}`, label: "回到單字集" }} title="單字集設定">
      <Loaded query={content}>{(data) => <Settings content={data} key={data.set.updatedAt} />}</Loaded>
    </Page>
  );
}

function Settings({ content }: { content: SetContent }) {
  const { set } = content;
  const library = useLibrary();
  const navigate = useNavigate();
  const online = useOnline();
  const [value, setValue] = useState<SetFormValue>({ name: set.name, folderId: set.folderId, hue: set.hue, icon: set.icon });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<"idle" | "loading">("idle");
  const [removing, setRemoving] = useState(false);
  const [deleting, setDeleting] = useState<"idle" | "loading">("idle");
  const changed = value.name !== set.name || value.folderId !== set.folderId || value.hue !== set.hue || value.icon !== set.icon;
  return (
    <div className="grid gap-10">
      <form
        className="grid gap-8"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!value.name.trim()) return setError("請輸入名稱");
          setSaving("loading");
          try {
            await updateSet(set, { ...value, name: value.name.trim() });
            toast.success("已儲存");
          } catch (reason) {
            setError(errorMessage(reason));
          } finally {
            setSaving("idle");
          }
        }}
      >
        <SetForm error={error} folders={library.data?.folders ?? []} onChange={(next) => { setValue(next); setError(""); }} value={value} />
        <Button className="justify-self-start" disabled={!changed || !online} size="lg" status={saving} type="submit" variant="primary">儲存</Button>
      </form>
      <ListGroup footer="單字、題目和分享連結會一起刪除，無法復原。練習紀錄會保留。" title="危險區">
        <ListRow disabled={!online} icon={<Trash />} label="刪除這個單字集" onClick={() => setRemoving(true)} tone="danger" />
      </ListGroup>
      <ConfirmDialog
        confirmLabel="刪除"
        description={`${content.words.length} 個單字和 ${content.questions.length} 題會一起刪除。`}
        onConfirm={async () => {
          setDeleting("loading");
          try {
            await deleteSet(set.id);
            toast.success(`已刪除「${set.name}」`);
            navigate("/app/library", { replace: true });
          } catch (reason) {
            toast.error(errorMessage(reason));
            setDeleting("idle");
          }
        }}
        onOpenChange={setRemoving}
        open={removing}
        status={deleting}
        title={`刪除「${set.name}」？`}
        tone="danger"
      />
    </div>
  );
}

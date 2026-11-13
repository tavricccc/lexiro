import { useEffect, useState } from "react";
import { Copy, LinkBreak, ShareNetwork } from "@phosphor-icons/react";
import { toast } from "sonner";
import type { SetSummary } from "@lexiro/contract";
import { Button, Input, Sheet, Spinner } from "design-kit";
import { errorMessage } from "@/data/api";
import { shareOf, shareSet, unshareSet } from "@/data/library";

/**
 * A share link works like a shared document: whoever opens it sees the set's
 * current words. One link per set; stopping sharing closes it for everyone.
 */
export function ShareSheet({ set, open, onOpenChange }: { set: SetSummary; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [link, setLink] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setLink(undefined);
    shareOf(set.id).then(setLink, (reason) => { toast.error(errorMessage(reason)); setLink(null); });
  }, [open, set.id]);
  const url = link ? `${location.origin}/shared/${link}` : "";
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try { await action(); } catch (reason) { toast.error(errorMessage(reason)); } finally { setBusy(false); }
  };
  return (
    <Sheet description="拿到連結的人都能看到這個單字集目前的單字，並複製到自己的帳號。" onOpenChange={onOpenChange} open={open} title={`分享「${set.name}」`}>
      {link === undefined ? (
        <div className="grid place-items-center py-8"><Spinner label="讀取中" /></div>
      ) : link ? (
        <div className="grid gap-4">
          <Input aria-label="分享連結" className="font-latin" onFocus={(event) => event.target.select()} readOnly value={url} />
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void navigator.clipboard.writeText(url).then(() => toast.success("已複製連結"))} variant="primary"><Copy />複製連結</Button>
            {"share" in navigator ? <Button onClick={() => void navigator.share({ title: set.name, url }).catch(() => {})}><ShareNetwork />分享…</Button> : null}
            <Button disabled={busy} onClick={() => void run(async () => { await unshareSet(set.id); setLink(null); toast.success("已停止分享"); })} variant="danger"><LinkBreak />停止分享</Button>
          </div>
        </div>
      ) : (
        <Button disabled={busy} onClick={() => void run(async () => setLink(await shareSet(set.id)))} variant="primary"><ShareNetwork />建立分享連結</Button>
      )}
    </Sheet>
  );
}

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, LinkBreak, ShareNetwork } from "@phosphor-icons/react";
import { toast } from "sonner";
import type { SetSummary } from "@lexiro/contract";
import { Button, ConfirmDialog, ListGroup, ListRow, Sheet } from "design-kit";
import { errorMessage } from "@/data/api";
import { shareOf, shareSet, unshareSet } from "@/data/library";
import { keys, queryClient } from "@/data/queries";
import { useOnline } from "@/ui/offline-banner";
import { Loaded } from "@/ui/page";

const copy = (text: string, done: string) =>
  navigator.clipboard.writeText(text).then(() => toast.success(done), () => toast.error("無法複製，請手動選取。"));

/**
 * A share works like a shared document: whoever has its link or code sees the
 * set's current words. One per set; stopping sharing closes it for everyone.
 */
export function ShareSheet({ set, open, onOpenChange }: { set: SetSummary; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet description="拿到連結或代碼的人都能看到這個單字集目前的單字，並複製到自己的帳號。" onOpenChange={onOpenChange} open={open} title={`分享「${set.name}」`}>
      <ShareBody set={set} />
    </Sheet>
  );
}

function ShareBody({ set }: { set: SetSummary }) {
  const online = useOnline();
  const share = useQuery({ queryKey: keys.share(set.id), queryFn: () => shareOf(set.id), staleTime: 0 });
  const [busy, setBusy] = useState(false);
  const [stopping, setStopping] = useState(false);
  const run = async (action: () => Promise<string | null>) => {
    setBusy(true);
    try {
      queryClient.setQueryData(keys.share(set.id), await action());
    } catch (reason) {
      toast.error(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Loaded query={share}>
      {(code) => {
        if (!code)
          return <Button disabled={busy || !online} onClick={() => void run(() => shareSet(set.id))} size="lg" variant="primary"><ShareNetwork />開始分享</Button>;
        const url = `${location.origin}/shared/${code}`;
        return (
          <div className="grid gap-5">
            <ListGroup>
              <ListRow
                detail={<span className="select-all break-all font-latin">{code}</span>}
                label="代碼"
                trailing={<Button aria-label="複製代碼" onClick={() => void copy(code, "已複製代碼")} size="icon-sm" variant="ghost"><Copy /></Button>}
              />
              <ListRow
                detail={<span className="select-all break-all font-latin">{url}</span>}
                label="連結"
                trailing={<Button aria-label="複製連結" onClick={() => void copy(url, "已複製連結")} size="icon-sm" variant="ghost"><Copy /></Button>}
              />
            </ListGroup>
            <div className="flex flex-wrap gap-2">
              {"share" in navigator
                ? <Button onClick={() => void navigator.share({ title: set.name, url }).catch(() => {})} variant="primary"><ShareNetwork />分享…</Button>
                : null}
              <Button disabled={busy || !online} onClick={() => setStopping(true)} variant="danger"><LinkBreak />停止分享</Button>
            </div>
            <ConfirmDialog
              confirmLabel="停止分享"
              description="現在的連結和代碼會失效，已經加入的人不受影響。"
              onConfirm={() => {
                setStopping(false);
                void run(async () => {
                  await unshareSet(set.id);
                  toast.success("已停止分享");
                  return null;
                });
              }}
              onOpenChange={setStopping}
              open={stopping}
              title="停止分享？"
              tone="danger"
            />
          </div>
        );
      }}
    </Loaded>
  );
}

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy, LinkBreak, ShareNetwork } from "@phosphor-icons/react";
import { toast } from "sonner";
import type { SetSummary } from "@lexiro/contract";
import { Button, ConfirmDialog, ListGroup, ListRow, Panel, Sheet, cn } from "design-kit";
import { errorMessage } from "@/data/api";
import { shareOf, shareSet, unshareSet } from "@/data/library";
import { keys, queryClient } from "@/data/queries";
import { useOnline } from "@/ui/offline-banner";
import { Loaded } from "@/ui/page";

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
          return <Button disabled={busy || !online} onClick={() => void run(() => shareSet(set.id))} size="lg" variant="primary"><ShareNetwork weight="bold" />開始分享</Button>;
        const url = `${location.origin}/shared/${code}`;
        return (
          <div className="grid gap-4">
            <Panel className="grid gap-5 pt-6">
              <p
                aria-label={`分享代碼 ${code.split("").join(" ")}`}
                className={cn(
                  "select-all break-all text-center font-latin font-bold text-ink",
                  code.length > 12 ? "text-lg tracking-normal" : "text-[2.125rem] leading-none tracking-[0.2em]",
                )}
              >
                {code}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <CopyButton label="複製代碼" text={code} />
                <CopyButton label="複製連結" text={url} />
              </div>
            </Panel>
            {"share" in navigator ? (
              <Button onClick={() => void navigator.share({ title: set.name, url }).catch(() => {})} size="lg" variant="primary">
                <ShareNetwork weight="bold" />分享連結…
              </Button>
            ) : null}
            <ListGroup>
              <ListRow
                disabled={busy || !online}
                icon={<LinkBreak />}
                label="停止分享"
                onClick={() => setStopping(true)}
                tone="danger"
              />
            </ListGroup>
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

function CopyButton({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <Button
      className={cn(copied && "bg-accent-soft text-accent-ink hover:bg-accent-soft")}
      onClick={() => {
        void navigator.clipboard.writeText(text).then(
          () => setCopied(true),
          () => toast.error("無法複製，請手動選取。"),
        );
      }}
      variant="ghost"
    >
      {copied ? <Check className="mark-in" weight="bold" /> : <Copy weight="bold" />}
      {copied ? "已複製" : label}
    </Button>
  );
}

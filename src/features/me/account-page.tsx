import { useState } from "react";
import { ArrowsClockwise, SignOut, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button, ConfirmDialog, ListGroup, ListRow, Panel, type ActionStatus } from "design-kit";
import { api, errorMessage } from "@/data/api";
import { deleteAccount, signOut, useAuth } from "@/data/auth";
import { flushAnswers, usePendingAnswers } from "@/data/learning";
import { queryClient } from "@/data/queries";
import { useOnline } from "@/ui/offline-banner";
import { Page } from "@/ui/page";

const BACK = { href: "/app/me", label: "我" };

export default function AccountPage() {
  const { account } = useAuth();
  const pending = usePendingAnswers();
  const online = useOnline();
  const [syncing, setSyncing] = useState<ActionStatus>("idle");
  const [leaving, setLeaving] = useState(false);
  const [erasing, setErasing] = useState<ActionStatus>("idle");
  const [confirm, setConfirm] = useState(false);
  const sync = async () => {
    setSyncing("loading");
    try {
      await flushAnswers();
      await queryClient.invalidateQueries();
      setSyncing("success");
      setTimeout(() => setSyncing("idle"), 1200);
    } catch (error) {
      setSyncing("idle");
      toast.error(errorMessage(error));
    }
  };
  const leave = async () => {
    if (pending && !confirm) { setConfirm(true); return; }
    setLeaving(true);
    await signOut().finally(() => setLeaving(false));
  };
  const erase = async () => {
    setErasing("loading");
    try {
      await deleteAccount(() => api("/account", { method: "DELETE" }).then(() => undefined));
    } catch (error) {
      setErasing("idle");
      toast.error(errorMessage(error));
    }
  };
  return (
    <Page back={BACK} kicker="ME // ACCOUNT & SYNC" title="帳號與同步" width="wide">
      <div className="grid items-start gap-6 lg:grid-cols-12">
        <div className="grid gap-6 lg:col-span-7">
          <Panel className="grid gap-2 border-t-2 border-t-line-strong">
            <span className="font-mono text-xs font-semibold uppercase tracking-[0.08em] text-ink-faint">SIGNED IN AS</span>
            <p className="font-mono text-lg font-bold">{account?.email}</p>
            <p className="text-sm text-ink-muted">單字集、練習紀錄和設定都綁定此帳號，跨裝置自動一致。</p>
          </Panel>
          <ListGroup footer={online ? "Lexiro 會自動同步；離線時可瀏覽與練習，作答於連線後上傳。" : "目前離線：可瀏覽與練習，修改需待連線。"} title="同步狀態">
            <ListRow label="尚未上傳的作答" value={pending ? `${pending} 筆` : "0"} />
            <ListRow label="立即同步" onClick={() => void sync()} disabled={!online || syncing !== "idle"} icon={<ArrowsClockwise weight="bold" />} value={syncing === "loading" ? "同步中…" : syncing === "success" ? "完成" : undefined} />
          </ListGroup>
        </div>

        <div className="grid gap-6 lg:col-span-5">
          <ListGroup title="工作階段">
            <ListRow disabled={leaving} icon={<SignOut weight="bold" />} label="登出帳號" onClick={() => void leave()} />
          </ListGroup>
          <Panel className="grid gap-4 border-t-2 border-t-danger">
            <span className="font-mono text-xs font-bold uppercase tracking-[0.1em] text-danger">DANGER ZONE</span>
            <p className="text-sm leading-relaxed text-ink-muted">永久刪除帳號的單字集、題目、練習紀錄與分享連結，無法復原。</p>
            <ConfirmDialog
              confirmLabel="永久刪除"
              description="刪除前會請你重新登入一次確認身分。所有資料都會消失，無法復原。"
              onConfirm={() => void erase()}
              status={erasing}
              title="刪除帳號？"
              tone="danger"
              trigger={<Button className="justify-self-start" disabled={!online} variant="danger"><Trash weight="bold" />刪除帳號</Button>}
            />
          </Panel>
        </div>
      </div>

      <ConfirmDialog
        confirmLabel="仍然登出"
        description={`還有 ${pending} 筆作答沒有上傳，登出後會遺失。建議先連上網路同步。`}
        onConfirm={() => { setConfirm(false); setLeaving(true); void signOut().finally(() => setLeaving(false)); }}
        onOpenChange={setConfirm}
        open={confirm}
        title="還有作答沒上傳"
        tone="danger"
      />
    </Page>
  );
}

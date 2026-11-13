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
    <Page back={BACK} title="帳號與同步">
      <Panel className="grid gap-1">
        <p className="text-sm text-ink-muted">登入帳號</p>
        <p className="font-semibold">{account?.email}</p>
        <p className="text-[0.8125rem] text-ink-muted">你的單字集、練習紀錄和設定都存在這個帳號，換裝置登入同一個帳號就會出現。</p>
      </Panel>
      <ListGroup footer={online ? "Lexiro 會自動同步；離線時可以瀏覽和練習，作答會在連線後送出。" : "目前離線：可以瀏覽和練習，但不能修改單字集。"} title="同步">
        <ListRow label="尚未上傳的作答" value={pending ? `${pending} 筆` : "沒有"} />
        <ListRow label="立即同步" onClick={() => void sync()} disabled={!online || syncing !== "idle"} icon={<ArrowsClockwise />} value={syncing === "loading" ? "同步中…" : syncing === "success" ? "完成" : undefined} />
      </ListGroup>
      <ListGroup title="帳號">
        <ListRow disabled={leaving} icon={<SignOut />} label="登出" onClick={() => void leave()} />
      </ListGroup>
      <ListGroup footer="會永久刪除這個帳號的單字集、題目、練習紀錄與分享連結，無法復原。" title="危險區域">
        <ConfirmDialog
          confirmLabel="永久刪除"
          description="刪除前會請你重新登入一次確認身分。所有資料都會消失，無法復原。"
          onConfirm={() => void erase()}
          status={erasing}
          title="刪除帳號？"
          tone="danger"
          trigger={<Button className="justify-self-start" disabled={!online} variant="danger"><Trash weight="bold" />刪除帳號</Button>}
        />
      </ListGroup>
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

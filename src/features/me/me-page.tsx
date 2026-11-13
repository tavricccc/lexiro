import { Database, Info, Robot, ShieldCheck, SlidersHorizontal, UserCircle } from "@phosphor-icons/react";
import { Avatar, ListGroup, ListRow, Panel } from "design-kit";
import { useAuth } from "@/data/auth";
import { useIsAdministrator } from "@/data/admin";
import { usePendingAnswers } from "@/data/learning";
import { Page } from "@/ui/page";

export default function MePage() {
  const { account } = useAuth();
  const admin = useIsAdministrator();
  const pending = usePendingAnswers();
  return (
    <Page title="我">
      <Panel className="flex items-center gap-4">
        <Avatar className="size-14" name={account?.name || account?.email || "?"} src={account?.photo} />
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold">{account?.name || "Lexiro 使用者"}</p>
          <p className="truncate text-sm text-ink-muted">{account?.email}</p>
        </div>
      </Panel>
      <ListGroup label="設定">
        <ListRow detail={pending ? `${pending} 筆作答等待上傳` : "登入、同步與登出"} href="/app/me/account" icon={<UserCircle />} label="帳號與同步" />
        <ListRow detail="外觀、練習題數、單字列表" href="/app/me/preferences" icon={<SlidersHorizontal />} label="偏好設定" />
        <ListRow detail="匯出、匯入備份" href="/app/me/data" icon={<Database />} label="資料與備份" />
        <ListRow detail="讓 AI 助理幫你出題" href="/app/me/agents" icon={<Robot />} label="Agent 連線" />
      </ListGroup>
      <ListGroup label="其他">
        <ListRow detail="版本與更新" href="/app/me/about" icon={<Info />} label="關於 Lexiro" />
        {admin ? <ListRow href="/app/me/admin" icon={<ShieldCheck />} label="管理後台" /> : null}
      </ListGroup>
    </Page>
  );
}

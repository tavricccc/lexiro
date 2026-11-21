import { Database, Info, Robot, ShieldCheck, SlidersHorizontal, UserCircle } from "@phosphor-icons/react";
import { Avatar, Chip, ListGroup, ListRow } from "design-kit";
import { useAuth } from "@/data/auth";
import { useIsAdministrator } from "@/data/admin";
import { usePendingAnswers } from "@/data/learning";
import { Page } from "@/ui/page";

export default function MePage() {
  const { account } = useAuth();
  const admin = useIsAdministrator();
  const pending = usePendingAnswers();
  return (
    <Page kicker="05 // PROFILE & DIRECTORY" title="我">
      <div className="grid items-start gap-8 lg:grid-cols-12">
        {/* Left: Swiss Identity Specimen Card */}
        <section className="grid gap-6 border-2 border-line-strong bg-surface p-6 md:p-8 lg:col-span-5">
          <div className="flex items-start justify-between gap-4">
            <Avatar className="size-16 text-xl" name={account?.name || account?.email || "?"} src={account?.photo} />
            <Chip tone={pending ? "caution" : "positive"}>{pending ? `${pending} 待同步` : "SYNCED"}</Chip>
          </div>
          <div className="grid gap-1 border-t border-line pt-5">
            <span className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-ink-faint">ACCOUNT</span>
            <p className="truncate text-2xl font-extrabold tracking-[-0.025em]">{account?.name || "Lexiro 使用者"}</p>
            <p className="truncate font-mono text-xs text-ink-muted">{account?.email}</p>
          </div>
        </section>

        {/* Right: Subpage Index */}
        <div className="grid gap-6 lg:col-span-7">
          <ListGroup title="01 // 設定">
            <ListRow detail={pending ? `${pending} 筆作答等待上傳` : "登入、同步與登出"} href="/app/me/account" icon={<UserCircle weight="bold" />} label="帳號與同步" />
            <ListRow detail="外觀、練習題數、單字列表" href="/app/me/preferences" icon={<SlidersHorizontal weight="bold" />} label="偏好設定" />
            <ListRow detail="匯出、匯入備份" href="/app/me/data" icon={<Database weight="bold" />} label="資料與備份" />
            <ListRow detail="讓 AI 助理幫你出題" href="/app/me/agents" icon={<Robot weight="bold" />} label="Agent 連線" />
          </ListGroup>
          <ListGroup title="02 // 系統">
            <ListRow detail="版本與更新" href="/app/me/about" icon={<Info weight="bold" />} label="關於 Lexiro" />
            {admin ? <ListRow href="/app/me/admin" icon={<ShieldCheck weight="bold" />} label="管理後台" /> : null}
          </ListGroup>
        </div>
      </div>
    </Page>
  );
}

import { useState } from "react";
import { useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { GoogleLogo } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button, EmptyState, ListGroup, ListRow, Panel, type ActionStatus } from "design-kit";
import { api, errorMessage } from "@/data/api";
import { currentAccount, signIn, useAuth } from "@/data/auth";
import { Brand } from "@/ui/brand";
import { Page } from "@/ui/page";

interface AuthorizationRequest { clientName: string; redirectHost: string; scopes: string[] }

export default function AuthorizePage() {
  const [query] = useSearchParams();
  const requestId = query.get("request") ?? "";
  const { ready, account } = useAuth();
  const request = useQuery({
    queryKey: ["oauth", requestId, account?.uid],
    queryFn: () => api<AuthorizationRequest>(`/oauth/request/${encodeURIComponent(requestId)}`),
    enabled: Boolean(account && requestId),
    retry: false,
  });
  const [status, setStatus] = useState<ActionStatus>("idle");
  const decide = async (allow: boolean) => {
    const uid = account?.uid;
    setStatus("loading");
    try {
      const { redirectTo } = await api<{ redirectTo: string }>(`/oauth/approve/${encodeURIComponent(requestId)}`, { method: "POST", json: { allow } });
      if (currentAccount()?.uid !== uid) throw new Error("登入的帳號已變更，請重新開始連線。");
      window.location.assign(redirectTo);
    } catch (error) {
      setStatus("idle");
      toast.error(errorMessage(error));
    }
  };
  return (
    <div className="swiss-grid-bg grid min-h-svh place-items-center px-[var(--gutter)] py-10">
      <div className="grid w-full max-w-xl gap-6 border-2 border-line-strong bg-surface p-6 shadow-float md:p-8">
        <Brand compact />
        <Page kicker="OAUTH // MCP ACCESS" title="連接 AI 助理">
          {!requestId ? (
            <EmptyState description="連結缺少授權請求，請從 AI 助理重新開始連線。" title="無效的連結" />
          ) : !ready ? null : !account ? (
            <Panel className="grid gap-4">
              <p className="text-sm text-ink-muted">登入後才能決定是否讓這個 AI 助理存取你的單字。</p>
              <Button className="justify-self-start" onClick={() => void signIn().catch((error) => toast.error(errorMessage(error)))} size="lg" variant="primary"><GoogleLogo weight="bold" />用 Google 登入</Button>
            </Panel>
          ) : request.isError ? (
            <EmptyState description={errorMessage(request.error)} title="無法讀取授權請求" />
          ) : !request.data ? null : (
            <div className="grid gap-5">
              <ListGroup>
                <ListRow detail={request.data.clientName} label="AI 助理" />
                <ListRow detail={account.email} label="帳號" />
                <ListRow detail={request.data.redirectHost} label="完成後返回" />
              </ListGroup>
              <p className="border-l-2 border-line-strong/40 pl-3 text-sm text-ink-muted">允許後，該助理可讀寫你的單字集與題目，隨時可在「我 › Agent 連線」撤銷。</p>
              <div className="grid grid-cols-2 gap-3">
                <Button disabled={status === "loading"} onClick={() => void decide(false)} size="lg" variant="secondary">拒絕</Button>
                <Button onClick={() => void decide(true)} size="lg" status={status} variant="primary">允許存取</Button>
              </div>
            </div>
          )}
        </Page>
      </div>
    </div>
  );
}

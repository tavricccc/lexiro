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

/** An AI client asks to reach this account over MCP; the user allows or denies it. */
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
    <div className="mx-auto grid w-full max-w-xl gap-6 px-[var(--gutter)] pb-12 pt-[calc(var(--safe-top)+1.5rem)]">
      <Brand />
      <Page title="連接 AI 助理">
        {!requestId ? (
          <EmptyState description="連結缺少授權請求，請從 AI 助理重新開始連線。" title="無效的連結" />
        ) : !ready ? null : !account ? (
          <Panel className="grid gap-3">
            <p className="text-[0.9375rem] text-ink-muted">登入後才能決定是否讓這個 AI 助理存取你的單字。</p>
            <Button className="justify-self-start" onClick={() => void signIn().catch((error) => toast.error(errorMessage(error)))} size="lg" variant="primary"><GoogleLogo weight="bold" />用 Google 登入</Button>
          </Panel>
        ) : request.isError ? (
          <EmptyState description={errorMessage(request.error)} title="無法讀取授權請求" />
        ) : !request.data ? null : (
          <>
            <ListGroup>
              <ListRow detail={request.data.clientName} label="AI 助理" />
              <ListRow detail={account.email} label="帳號" />
              <ListRow detail={request.data.redirectHost} label="完成後返回" />
            </ListGroup>
            <p className="text-[0.9375rem] text-ink-muted">允許後，這個助理可以讀取、建立和修改你的單字集與題目，直到你在「我 › AI 助理」撤銷。</p>
            <div className="flex flex-wrap justify-end gap-3">
              <Button disabled={status === "loading"} onClick={() => void decide(false)} variant="secondary">拒絕</Button>
              <Button onClick={() => void decide(true)} status={status} variant="primary">允許</Button>
            </div>
          </>
        )}
      </Page>
    </div>
  );
}

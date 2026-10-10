"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ListRow, ListSection } from "@/components/ui/list";
import { PageHeader } from "@/components/ui/page-header";
import { LoadingState } from "@/components/ui/page-state";
import { agentJson } from "@/lib/agent-client";
import { t } from "@/lib/i18n";
import { useCloudStore } from "@/stores/cloud-store";

interface AuthorizationInfo {
  clientName: string;
  redirectHost: string;
  scopes: string[];
}
export function AgentOAuthConsent({ requestId }: { requestId: string }) {
  const {
    user,
    ready,
    signIn,
    initialize,
    error: cloudError,
  } = useCloudStore();
  const [info, setInfo] = useState<AuthorizationInfo | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const currentUid = useRef(user?.uid);
  currentUid.current = user?.uid;
  useEffect(() => {
    void initialize();
  }, [initialize]);
  useEffect(() => {
    setInfo(null);
    setError("");
    if (!ready || !user) return;
    const controller = new AbortController();
    void agentJson<AuthorizationInfo>(
      `/oauth/request/${encodeURIComponent(requestId)}`,
      { signal: controller.signal },
    )
      .then((value) => {
        if (!controller.signal.aborted) setInfo(value);
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error ? reason.message : t("agent.requestFailed"),
          );
      });
    return () => controller.abort();
  }, [ready, user, requestId]);
  const approve = async (allow: boolean) => {
    const uid = user?.uid;
    setBusy(true);
    setError("");
    try {
      const result = await agentJson<{ redirectTo: string }>(
        `/oauth/approve/${encodeURIComponent(requestId)}`,
        { method: "POST", body: JSON.stringify({ allow }) },
      );
      if (currentUid.current !== uid)
        throw new Error(t("agent.accountChanged"));
      window.location.assign(result.redirectTo);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : t("agent.requestFailed"),
      );
      setBusy(false);
    }
  };
  return (
    <main className="mx-auto max-w-xl px-5 py-10 sm:py-16">
      <PageHeader
        title={t("agent.connectTitle")}
        footer={
          <p className="text-sm text-muted-foreground">
            {t("agent.connectDescription")}
          </p>
        }
      />
      {!ready && !cloudError ? (
        <LoadingState />
      ) : !user ? (
        <Button
          onClick={() =>
            void signIn().catch((reason) => setError(String(reason)))
          }
        >
          {t("agent.signIn")}
        </Button>
      ) : info ? (
        <div className="space-y-6">
          <ListSection>
            <ListRow label={t("agent.client")} value={info.clientName} />
            <ListRow label={t("agent.account")} value={user.email} />
            <ListRow label={t("agent.returnTo")} value={info.redirectHost} />
          </ListSection>
          <p className="text-sm leading-relaxed">
            {t("agent.oauthPermission")}
          </p>
          <div className="flex flex-wrap justify-end gap-3">
            <Button
              disabled={busy}
              variant="outline"
              onClick={() => void approve(false)}
            >
              {t("agent.deny")}
            </Button>
            <Button disabled={busy} onClick={() => void approve(true)}>
              {t("agent.allow")}
            </Button>
          </div>
        </div>
      ) : (
        !error && <LoadingState />
      )}
      {(error || cloudError) && (
        <p role="alert" className="mt-5 text-sm text-destructive">
          {error || cloudError}
        </p>
      )}
    </main>
  );
}

import { useEffect, useState } from "react";
import { BackControl } from "@/components/ui/back-control";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icons } from "@/components/ui/icons";
import { ListSection } from "@/components/ui/list";
import { PageHeader } from "@/components/ui/page-header";
import { LoadingState } from "@/components/ui/page-state";
import {
  agentJson,
  agentWorkerUrl,
  type AgentConnection,
} from "@/lib/agent-client";
import { t } from "@/lib/i18n";
import { useCloudStore } from "@/stores/cloud-store";

export function AgentConnectionsPage() {
  const { user, ready, signIn } = useCloudStore();
  const [connections, setConnections] = useState<AgentConnection[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const endpoint = agentWorkerUrl() ? `${agentWorkerUrl()}/mcp` : "";
  useEffect(() => {
    setConnections([]);
    setError("");
    setLoading(true);
    if (!ready || !user) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    void agentJson<{ connections: AgentConnection[] }>("/connections", {
      signal: controller.signal,
    })
      .then((a) => {
        if (!controller.signal.aborted) {
          setConnections(a.connections);
        }
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error ? reason.message : t("agent.requestFailed"),
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [ready, user, refresh]);
  const revoke = async (path: string, id: string) => {
    setBusy(id);
    setError("");
    try {
      await agentJson(`${path}/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      setRefresh((value) => value + 1);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : t("agent.requestFailed"),
      );
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        back={<BackControl href="/app/me" />}
        title={t("agent.connections")}
        actions={
          <Button
            variant="glass"
            disabled={loading}
            onClick={() => setRefresh((value) => value + 1)}
          >
            {t("agent.refresh")}
          </Button>
        }
      />
      <ListSection
        header={t("agent.endpoint")}
        footer={endpoint ? t("agent.endpointHint") : t("agent.unavailable")}
      >
        {endpoint && (
          <div className="flex items-center gap-2 py-3">
            <Input
              aria-label={t("agent.endpoint")}
              readOnly
              value={endpoint}
              onFocus={(event) => event.currentTarget.select()}
            />
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(endpoint);
                  setCopied(true);
                } catch {
                  setError(t("agent.copyFailed"));
                }
              }}
            >
              <Icons.copy />
              <span>{t(copied ? "agent.copied" : "agent.copy")}</span>
            </Button>
          </div>
        )}
      </ListSection>
      {!ready || loading ? (
        <LoadingState />
      ) : !user ? (
        <Button
          onClick={() =>
            void signIn().catch((reason) => setError(String(reason)))
          }
        >
          {t("agent.signIn")}
        </Button>
      ) : (
        !error && (
          <>
            <ListSection header={t("agent.oauthConnections")}>
              {connections.length ? (
                connections.map((connection) => (
                  <div
                    key={connection.id}
                    className="flex items-center gap-3 py-[var(--row-padding-block)]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="type-row break-words">
                        {connection.clientName}
                      </p>
                      <p className="type-row-detail break-all">
                        {connection.clientId}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      disabled={busy !== null}
                      onClick={() => void revoke("/connections", connection.id)}
                    >
                      {t("agent.disconnect")}
                    </Button>
                  </div>
                ))
              ) : (
                <p className="py-4 text-sm text-muted-foreground">
                  {t("agent.noConnections")}
                </p>
              )}
            </ListSection>
          </>
        )
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

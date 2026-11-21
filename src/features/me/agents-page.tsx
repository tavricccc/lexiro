import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, LinkBreak, Robot } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button, ConfirmDialog, EmptyState, ListGroup, ListRow, Panel, type ActionStatus } from "design-kit";
import { api, errorMessage } from "@/data/api";
import { workerUrl } from "@/data/config";
import { Loaded, Page } from "@/ui/page";

interface Connection { id: string; clientId: string; clientName: string; createdAt: number }

export default function AgentsPage() {
  const connections = useQuery({ queryKey: ["connections"], queryFn: () => api<{ connections: Connection[] }>("/connections").then((r) => r.connections) });
  const [revoking, setRevoking] = useState<Connection | null>(null);
  const [status, setStatus] = useState<ActionStatus>("idle");
  const endpoint = `${workerUrl}/mcp`;
  const copy = () => navigator.clipboard.writeText(endpoint).then(() => toast.success("已複製網址"), () => toast.error("無法複製，請手動選取。"));
  const revoke = async () => {
    if (!revoking) return;
    setStatus("loading");
    try {
      await api(`/connections/${encodeURIComponent(revoking.id)}`, { method: "DELETE" });
      await connections.refetch();
      setRevoking(null);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setStatus("idle");
    }
  };
  return (
    <Page back={{ href: "/app/me", label: "我" }} description="讓 Claude 等 AI 助理透過 MCP 讀取你的單字集並出題。" kicker="ME // MCP AGENTS" title="Agent 連線" width="wide">
      <div className="grid items-start gap-6 lg:grid-cols-12">
        <Panel className="grid gap-4 border-2 border-line-strong lg:col-span-5">
          <span className="font-mono text-xs font-semibold uppercase tracking-[0.1em] text-contrast">MCP ENDPOINT</span>
          <div className="flex items-stretch gap-2">
            <code className="flex min-w-0 flex-1 items-center truncate border border-line bg-surface-raised px-3.5 py-2.5 font-mono text-xs text-ink">{endpoint}</code>
            <Button aria-label="複製網址" onClick={() => void copy()} size="icon" variant="primary"><Copy weight="bold" /></Button>
          </div>
          <p className="text-xs leading-relaxed text-ink-muted">在助理的「新增連接器」貼上此網址，依指示登入並授權即可。</p>
        </Panel>

        <div className="lg:col-span-7">
          <Loaded query={connections}>
            {(list) => list.length ? (
              <ListGroup footer="中斷後該助理將無法再讀寫單字集，可隨時重新連線。" title="已授權連線">
                {list.map((connection) => (
                  <ListRow
                    detail={`連線於 ${new Date(connection.createdAt * (connection.createdAt < 1e12 ? 1000 : 1)).toLocaleDateString("zh-TW")}`}
                    icon={<Robot weight="bold" />}
                    key={connection.id}
                    label={connection.clientName}
                    trailing={<Button aria-label={`中斷 ${connection.clientName}`} onClick={() => setRevoking(connection)} size="icon-sm" variant="danger"><LinkBreak weight="bold" /></Button>}
                  />
                ))}
              </ListGroup>
            ) : <EmptyState description="授權後的 AI 助理會顯示於此。" title="還沒有連線的助理" />}
          </Loaded>
        </div>
      </div>

      <ConfirmDialog
        confirmLabel="中斷連線"
        description={revoking ? `「${revoking.clientName}」將不能再存取你的單字集。` : undefined}
        onConfirm={() => void revoke()}
        onOpenChange={(open) => { if (!open) setRevoking(null); }}
        open={revoking !== null}
        status={status}
        title="中斷連線？"
        tone="danger"
      />
    </Page>
  );
}

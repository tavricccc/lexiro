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
    <Page back={{ href: "/app/me", label: "我" }} description="讓 Claude 等 AI 助理讀取你的單字集並幫你出題。題目由助理產生，Lexiro 只負責儲存。" title="Agent 連線">
      <Panel className="grid gap-3">
        <p className="text-sm font-medium">MCP 伺服器網址</p>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-tile bg-surface-raised px-3 py-2 font-latin text-sm">{endpoint}</code>
          <Button aria-label="複製網址" onClick={() => void copy()} size="icon"><Copy weight="bold" /></Button>
        </div>
        <p className="text-[0.8125rem] text-ink-muted">在助理的「新增連接器」貼上這個網址，依指示用你的 Lexiro 帳號登入並允許存取即可。</p>
      </Panel>
      <Loaded query={connections}>
        {(list) => list.length ? (
          <ListGroup footer="中斷後，該助理就不能再讀寫你的單字集，需要時可以重新連線。" title="已連線">
            {list.map((connection) => (
              <ListRow
                detail={`連線於 ${new Date(connection.createdAt * (connection.createdAt < 1e12 ? 1000 : 1)).toLocaleDateString("zh-TW")}`}
                icon={<Robot />}
                key={connection.id}
                label={connection.clientName}
                trailing={<Button aria-label={`中斷 ${connection.clientName}`} onClick={() => setRevoking(connection)} size="icon-sm" variant="ghost"><LinkBreak weight="bold" /></Button>}
              />
            ))}
          </ListGroup>
        ) : <EmptyState description="連線後會列在這裡。" title="還沒有連線的助理" />}
      </Loaded>
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

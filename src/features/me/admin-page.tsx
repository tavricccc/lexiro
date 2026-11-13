import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button, ConfirmDialog, EmptyState, Field, Input, ListGroup, ListRow, Tile, type ActionStatus } from "design-kit";
import { api, errorMessage } from "@/data/api";
import { useAuth } from "@/data/auth";
import { useIsAdministrator } from "@/data/admin";
import { Loaded, Page } from "@/ui/page";

interface AdminAccount { uid: string; email: string; name: string; writesToday: number; readsToday: number; words: number; disabled: boolean }
interface Overview {
  day: string; accounts: number; activeToday: number; writesToday: number; readsToday: number; words: number; agentPaused: boolean;
  disabled: { uid: string; email: string; name: string; reason: string; disabledAt: number }[];
  top: AdminAccount[];
}
type Target = { uid: string; label: string; disabled: boolean };

const n = (value: number) => value.toLocaleString("en-US");

export default function AdminPage() {
  const admin = useIsAdministrator();
  const { account } = useAuth();
  const overview = useQuery({ queryKey: ["admin", "overview"], queryFn: () => api<Overview>("/admin/overview"), enabled: admin });
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminAccount[] | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<ActionStatus>("idle");
  const search = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setResults((await api<{ accounts: AdminAccount[] }>(`/admin/search?q=${encodeURIComponent(query.trim())}`)).accounts);
    } catch (error) { toast.error(errorMessage(error)); }
  };
  const toggle = async () => {
    if (!target) return;
    setStatus("loading");
    try {
      const path = `/admin/accounts/${encodeURIComponent(target.uid)}/disabled`;
      if (target.disabled) await api(path, { method: "DELETE" });
      else await api(path, { method: "PUT", json: { reason } });
      setResults((list) => list?.map((entry) => entry.uid === target.uid ? { ...entry, disabled: !target.disabled } : entry) ?? null);
      await overview.refetch();
      setTarget(null);
      setReason("");
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setStatus("idle"); }
  };
  const row = (entry: AdminAccount) => (
    <ListRow
      detail={`${entry.email || entry.uid} · ${n(entry.words)} 字 · 今日寫 ${n(entry.writesToday)} / 讀 ${n(entry.readsToday)}`}
      key={entry.uid}
      label={entry.name || entry.email || entry.uid}
      trailing={entry.uid === account?.uid ? undefined : (
        <Button onClick={() => setTarget({ uid: entry.uid, label: entry.name || entry.email || entry.uid, disabled: entry.disabled })} size="sm" variant={entry.disabled ? "secondary" : "danger"}>{entry.disabled ? "恢復" : "停用"}</Button>
      )}
    />
  );
  if (!admin) return <Page back={{ href: "/app/me", label: "我" }} title="管理後台"><EmptyState description="這個帳號沒有管理權限。" title="無法存取" /></Page>;
  return (
    <Page back={{ href: "/app/me", label: "我" }} title="管理後台">
      <Loaded query={overview}>
        {(data) => (
          <>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
              {([["帳號", data.accounts], ["今日活躍", data.activeToday], ["今日寫入", data.writesToday], ["今日讀取", data.readsToday], ["單字總數", data.words]] as const).map(([label, value]) => (
                <Tile key={label}><p className="text-sm text-ink-muted">{label}</p><p className="font-latin text-2xl font-bold">{n(value)}</p></Tile>
              ))}
            </div>
            {data.agentPaused ? <p className="rounded-tile bg-caution/15 px-4 py-3 text-sm text-caution">Agent 服務目前暫停中。</p> : null}
            <ListGroup title={`今日用量最高（${data.day}）`}>{data.top.length ? data.top.map(row) : <ListRow label="今天還沒有活動" />}</ListGroup>
            {data.disabled.length ? (
              <ListGroup title="已停用">
                {data.disabled.map((entry) => (
                  <ListRow
                    detail={`${entry.reason || "未填原因"} · ${new Date(entry.disabledAt).toLocaleDateString("zh-TW")}`}
                    key={entry.uid}
                    label={entry.name || entry.email || entry.uid}
                    trailing={<Button onClick={() => setTarget({ uid: entry.uid, label: entry.name || entry.email || entry.uid, disabled: true })} size="sm">恢復</Button>}
                  />
                ))}
              </ListGroup>
            ) : null}
          </>
        )}
      </Loaded>
      <form className="flex gap-2" onSubmit={(event) => void search(event)}>
        <Input aria-label="搜尋帳號" className="flex-1" onChange={(event) => setQuery(event.target.value)} placeholder="Email、名稱或 UID" value={query} />
        <Button aria-label="搜尋" disabled={!query.trim()} size="icon" type="submit"><MagnifyingGlass weight="bold" /></Button>
      </form>
      {results ? <ListGroup title="搜尋結果">{results.length ? results.map(row) : <ListRow label="找不到符合的帳號" />}</ListGroup> : null}
      <ConfirmDialog
        confirmLabel={target?.disabled ? "恢復帳號" : "停用帳號"}
        description={target ? (target.disabled ? `「${target.label}」將可以再次使用 Lexiro。` : `「${target.label}」將無法讀寫資料，直到你恢復它。`) : undefined}
        onConfirm={() => void toggle()}
        onOpenChange={(open) => { if (!open) setTarget(null); }}
        open={target !== null}
        status={status}
        title={target?.disabled ? "恢復帳號？" : "停用帳號？"}
        tone={target?.disabled ? "default" : "danger"}
      >
        {target && !target.disabled ? <Field label="原因（選填）">{({ id }) => <Input id={id} maxLength={200} onChange={(event) => setReason(event.target.value)} value={reason} />}</Field> : null}
      </ConfirmDialog>
    </Page>
  );
}

import { useRef, useState } from "react";
import { DownloadSimple, UploadSimple } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button, ConfirmDialog, ListGroup, Panel, type ActionStatus } from "design-kit";
import { api, errorMessage } from "@/data/api";
import { calendarDay } from "@lexiro/contract";
import { invalidate } from "@/data/queries";
import { useOnline } from "@/ui/offline-banner";
import { Page } from "@/ui/page";

export default function DataPage() {
  const online = useOnline();
  const input = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState<ActionStatus>("idle");
  const [importing, setImporting] = useState<ActionStatus>("idle");
  const [file, setFile] = useState<File | null>(null);
  const download = async () => {
    setExporting("loading");
    try {
      const backup = await api<unknown>("/backup");
      const url = URL.createObjectURL(new Blob([JSON.stringify(backup)], { type: "application/json" }));
      const link = Object.assign(document.createElement("a"), { href: url, download: `lexiro-${calendarDay(new Date())}.json` });
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setExporting("success");
      setTimeout(() => setExporting("idle"), 1200);
    } catch (error) {
      setExporting("idle");
      toast.error(errorMessage(error));
    }
  };
  const restore = async () => {
    if (!file) return;
    setImporting("loading");
    try {
      let backup: unknown;
      try { backup = JSON.parse(await file.text()); } catch { throw new Error("這不是 Lexiro 的備份檔。"); }
      const result = await api<{ sets: number; words: number; questions: number }>("/backup", { method: "POST", json: backup });
      await invalidate();
      toast.success(`已匯入 ${result.sets} 個單字集、${result.words} 個單字、${result.questions} 題`);
      setFile(null);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setImporting("idle");
    }
  };
  return (
    <Page back={{ href: "/app/me", label: "我" }} title="資料與備份">
      <ListGroup footer="下載一份包含所有資料夾、單字集、單字和題目的 JSON 檔。練習紀錄不包含在內。" title="匯出">
        <Panel>
          <Button disabled={!online} onClick={() => void download()} status={exporting} variant="primary"><DownloadSimple weight="bold" />下載備份</Button>
        </Panel>
      </ListGroup>
      <ListGroup footer="備份裡的單字集會新增為新的單字集，不會覆蓋或刪除現有的資料。" title="匯入">
        <Panel>
          <input accept="application/json,.json" className="hidden" onChange={(event) => { setFile(event.target.files?.[0] ?? null); event.target.value = ""; }} ref={input} type="file" />
          <Button disabled={!online} onClick={() => input.current?.click()}><UploadSimple weight="bold" />選擇備份檔</Button>
        </Panel>
      </ListGroup>
      <ConfirmDialog
        confirmLabel="匯入"
        description={file ? `要從「${file.name}」匯入嗎？內容會加到你現有的單字集旁邊。` : undefined}
        onConfirm={() => void restore()}
        onOpenChange={(open) => { if (!open) setFile(null); }}
        open={file !== null}
        status={importing}
        title="匯入備份？"
      />
    </Page>
  );
}

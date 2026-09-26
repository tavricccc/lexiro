import { Icons } from "@/components/ui/icons";
import { t } from "@/lib/i18n";
import type { DraftPersistence } from "@/lib/draft-persistence";

export function DraftSaveStatus({ status }: { status: DraftPersistence }) {
  if (status === "idle") return null;
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs ${status === "error" ? "text-destructive" : "text-muted-foreground"}`}
      role={status === "error" ? "alert" : "status"}
    >
      {status === "saved" && <Icons.success aria-hidden className="size-3.5" />}
      {t(status === "error" ? "draft.saveFailed" : "draft.saved")}
    </span>
  );
}

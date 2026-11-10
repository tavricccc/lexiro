import { t } from "@/lib/i18n";
import type { DraftPersistence } from "@/lib/draft-persistence";
export function DraftSaveStatus({ status }: { status: DraftPersistence; compact?: boolean }) {
  return status === "error" ? <span className="text-xs text-destructive" role="alert">{t("draft.saveFailed")}</span> : null;
}

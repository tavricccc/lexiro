"use client";

import { ListActionRow, ListRow, ListSection } from "@/components/ui/list";
import { t } from "@/lib/i18n";

export interface AdminSettingsValue {
  freeTrial: boolean;
  trialPoints: number;
  defaultInitial: number;
  defaultMonthly: number;
}

export interface UsageReport {
  entries: import("@lexiro/ai-contract").AdminUsageEntry[];
  nextOffset: number | null;
  models: {
    model: string;
    runs: number;
    input: number;
    cached: number;
    output: number;
    credits: number | null;
  }[];
  /** One row per account per model, so cost stays a model rate times tokens. */
  users: import("@lexiro/ai-contract").AdminUserUsage[];
}

export function AdminIssue({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <ListSection>
      <ListRow label={message} tone="destructive" />
      <ListActionRow onClick={onRetry}>{t("common.retry")}</ListActionRow>
    </ListSection>
  );
}

export function AdminPager({
  hasNext,
  hasPrevious,
  onNext,
  onPrevious,
}: {
  hasNext: boolean;
  hasPrevious: boolean;
  onNext: () => void;
  onPrevious: () => void;
}) {
  if (!hasNext && !hasPrevious) return null;
  return (
    <ListSection>
      {hasPrevious && (
        <ListActionRow onClick={onPrevious}>{t("admin.previous")}</ListActionRow>
      )}
      {hasNext && (
        <ListActionRow onClick={onNext}>{t("admin.next")}</ListActionRow>
      )}
    </ListSection>
  );
}

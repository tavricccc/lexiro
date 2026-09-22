"use client";

import { ListActionRow, ListRow, ListSection } from "@/components/ui/list";
import { t } from "@/lib/i18n";

export interface AdminSettingsValue {
  /** Whether a brand new account is handed the defaults below, or nothing. */
  freeTrial: boolean;
  defaultInitial: number;
  defaultMonthly: number;
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

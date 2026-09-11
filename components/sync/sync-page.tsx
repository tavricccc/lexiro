"use client";

import { AccountSection } from "@/components/me/account-section";
import { PageHeader } from "@/components/ui/page-header";
import { t } from "@/lib/i18n";

export function SyncPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={t("sync.title")} />
      <AccountSection />
    </div>
  );
}

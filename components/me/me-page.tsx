"use client";

import { DataSection } from "@/components/me/data-section";
import { PlanSection } from "@/components/me/plan-section";
import { PreferencesSection } from "@/components/me/preferences-section";
import { PageHeader } from "@/components/ui/page-header";
import { t } from "@/lib/i18n";

export function MePage() {
  return <div className="mx-auto max-w-4xl">
    <PageHeader title={t("me.title")} />
    <PreferencesSection />
    <PlanSection />
    <DataSection />
  </div>;
}

"use client";

import { AccountRow } from "@/components/me/account-row";
import { DataSection } from "@/components/me/data-section";
import { PlanSection } from "@/components/me/plan-section";
import { PreferencesSection } from "@/components/me/preferences-section";
import { PageHeader } from "@/components/ui/page-header";
import { t } from "@/lib/i18n";

/**
 * 我的 is a column of grouped lists, one screen wide even on a desktop.
 *
 * It used to be a two-column page of labelled form fields, which on a phone
 * collapsed into a stack of boxes with headings — a web form. Settings are a
 * list: each line says what it is and what it is set to, and the column stays
 * narrow because a row whose label and value are half a screen apart is no
 * longer one line of reading.
 */
export function MePage() {
  return (
    <div className="mx-auto max-w-xl space-y-7 pb-4">
      <PageHeader className="mb-0" title={t("me.title")} />
      <AccountRow />
      <PreferencesSection />
      <PlanSection />
      <DataSection />
    </div>
  );
}

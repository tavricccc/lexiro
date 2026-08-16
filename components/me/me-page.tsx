"use client";

import { useEffect, useState } from "react";

import { AccountSection } from "@/components/me/account-section";
import { AiSettingsSection } from "@/components/me/ai-settings-section";
import { DataSection } from "@/components/me/data-section";
import { PreferencesSection } from "@/components/me/preferences-section";
import { PageHeader } from "@/components/page-header";
import { t } from "@/lib/i18n";
import {
  defaultAiSettings,
  loadAiSettingsState,
} from "@/src/lib/ai-provider";
import type { AiSettings } from "@/types";

export function MePage() {
  const [aiSettings, setAiSettings] = useState<AiSettings>(defaultAiSettings);

  useEffect(() => {
    void loadAiSettingsState().then(setAiSettings);
  }, []);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={t("me.title")} description={t("me.description")} />
      <AccountSection />
      <PreferencesSection />
      <AiSettingsSection settings={aiSettings} onChange={setAiSettings} />
      <DataSection
        aiSettings={aiSettings}
        onAiSettingsChange={setAiSettings}
      />
    </div>
  );
}

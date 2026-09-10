"use client";

import { useEffect, useState } from "react";

import { AccountSection } from "@/components/me/account-section";
import { AiSettingsSection } from "@/components/me/ai-settings-section";
import { DataSection } from "@/components/me/data-section";
import { PreferencesSection } from "@/components/me/preferences-section";
import { PageHeader } from "@/components/ui/page-header";
import { t } from "@/lib/i18n";
import {
  defaultAiSettings,
  loadAiSettingsState,
} from "@/src/lib/ai-provider";
import type { AiSettings } from "@/types";

export function MePage() {
  const [aiSettings, setAiSettings] = useState<AiSettings>(defaultAiSettings);
  // Autosave must not treat the jump from defaults to stored values as an edit,
  // so the section is told when the real settings have landed.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    void loadAiSettingsState().then((settings) => {
      setAiSettings(settings);
      setHydrated(true);
    });
  }, []);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={t("me.title")} description={t("me.description")} />
      <AccountSection />
      <PreferencesSection />
      <AiSettingsSection
        hydrated={hydrated}
        onChange={setAiSettings}
        settings={aiSettings}
      />
      <DataSection
        aiSettings={aiSettings}
        onAiSettingsChange={setAiSettings}
      />
    </div>
  );
}

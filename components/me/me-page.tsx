"use client";

import { useEffect, useState } from "react";

import { AiSettingsSection } from "@/components/me/ai-settings-section";
import { DataSection } from "@/components/me/data-section";
import { PreferencesSection } from "@/components/me/preferences-section";
import { PageHeader } from "@/components/ui/page-header";
import { t } from "@/lib/i18n";
import {
  defaultAiSettings,
  loadAiSettings,
  onAiSettingsChanged,
} from "@/src/lib/ai-provider";
import { useCloudStore } from "@/stores/cloud-store";
import type { AiSettings } from "@/types";

export function MePage() {
  const [aiSettings, setAiSettings] = useState<AiSettings>(defaultAiSettings);
  // Autosave must not treat the jump from defaults to stored values as an edit,
  // so the section is told when the real settings have landed.
  const [hydrated, setHydrated] = useState(false);
  // Settings belong to an account, and the cloud store is what decides which
  // account that is. `ready` is the moment it has decided and read this one's.
  const ready = useCloudStore((store) => store.ready);

  // Then stay subscribed. The settings can change underneath this screen twice
  // over — signing in swaps the account, and a sync brings down what another
  // device configured — and reading them once left both showing the old values
  // until the page was reopened.
  useEffect(() => {
    if (!ready) return;
    setAiSettings(loadAiSettings());
    setHydrated(true);
    return onAiSettingsChanged(setAiSettings);
  }, [ready]);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={t("me.title")} />
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

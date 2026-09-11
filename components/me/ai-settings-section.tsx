"use client";

import type { AiProvider, AiSettings } from "@/types";
import { useState } from "react";
import { toast } from "sonner";

import { MeSection } from "@/components/me/me-section";
import { useAutosave } from "@/components/me/use-autosave";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Icons } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { Switch } from "@/components/ui/switch";
import { t } from "@/lib/i18n";
import {
  downloadAiSettings,
  parseAiSettingsJson,
  saveAiSettings,
  waitForAiSettingsPersistence,
} from "@/src/lib/ai-provider";

const PROVIDERS: { label: string; value: AiProvider }[] = [
  { label: "OpenAI", value: "openai" },
  { label: "Anthropic", value: "anthropic" },
  { label: "Google", value: "google" },
  { label: "OpenAI compatible", value: "custom" },
];

export function AiSettingsSection({
  hydrated,
  settings,
  onChange,
}: {
  hydrated: boolean;
  settings: AiSettings;
  onChange: (settings: AiSettings) => void;
}) {
  const [showApiKey, setShowApiKey] = useState(false);
  const update = (patch: Partial<AiSettings>) =>
    onChange({ ...settings, ...patch });

  const missingKey = settings.enabled && !settings.apiKey.trim();
  const status = useAutosave(
    settings,
    async (value) => {
      saveAiSettings(value);
      await waitForAiSettingsPersistence();
    },
    // Not before the stored settings have loaded, and not while the
    // configuration is incomplete -- a half-typed key would be written as a
    // broken configuration.
    { ready: hydrated && !missingKey },
  );

  const importSettings = async (file: File) => {
    try {
      const imported = parseAiSettingsJson(await file.text());
      const next = { ...imported, apiKey: settings.apiKey };
      onChange(next);
      saveAiSettings(next);
      await waitForAiSettingsPersistence();
      toast.success(t("settings.aiSaved"));
    } catch (reason) {
      toast.error(
        t("settings.invalidBackup", {
          message: reason instanceof Error ? reason.message : String(reason),
        }),
      );
    }
  };

  return (
    <MeSection
      description={t("settings.aiDescription")}
      icon={Icons.ai}
      status={status}
      title={t("settings.ai")}
    >
      <div className="grid gap-5">
        <div className="flex items-center justify-between gap-4 rounded-[var(--radius-card)] bg-[var(--surface-inset)] px-4 py-3.5">
          <div>
            <p className="text-sm font-medium">{t("me.directApi")}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {t("me.directApiDescription")}
            </p>
          </div>
          <Switch
            aria-label={t("me.directApi")}
            checked={settings.enabled}
            onCheckedChange={(enabled) => update({ enabled })}
          />
        </div>

        {settings.enabled && (
          <div className="t-panel-reveal grid gap-5">
            <SelectField
              label={t("settings.provider")}
              layout="row"
              onValueChange={(provider) =>
                update({ provider: provider as AiProvider })
              }
              options={PROVIDERS}
              value={settings.provider}
            />
            <Field label={t("settings.model")} layout="row">
              <Input
                onChange={(event) => update({ model: event.target.value })}
                value={settings.model}
              />
            </Field>
            <Field
              error={missingKey && t("me.apiKeyRequired")}
              label={t("settings.apiKey")}
              layout="row"
            >
              <span className="relative block">
                <Input
                  autoComplete="off"
                  className="pr-12"
                  onChange={(event) => update({ apiKey: event.target.value })}
                  type={showApiKey ? "text" : "password"}
                  value={settings.apiKey}
                />
                <button
                  aria-label={t(showApiKey ? "me.hideApiKey" : "me.showApiKey")}
                  className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-md text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
                  onClick={() => setShowApiKey((visible) => !visible)}
                  type="button"
                >
                  {showApiKey ? (
                    <Icons.hide className="size-4" />
                  ) : (
                    <Icons.reveal className="size-4" />
                  )}
                </button>
              </span>
            </Field>
            <details className="group rounded-[var(--radius-card)] border px-4 py-3.5 open:bg-[var(--surface-inset)]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium marker:content-none">
                {t("me.advanced")}
                <Icons.open
                  aria-hidden
                  className="size-4 shrink-0 text-muted-foreground transition-transform duration-[var(--motion-quick)] group-open:rotate-90"
                />
              </summary>
              <div className="mt-5 grid gap-5 border-t pt-5">
                <Field
                  description={t("me.endpointHint")}
                  label={t("settings.endpoint")}
                  layout="row"
                >
                  <Input
                    inputMode="url"
                    onChange={(event) => update({ baseUrl: event.target.value })}
                    placeholder={t("me.endpointPlaceholder")}
                    value={settings.baseUrl}
                  />
                </Field>
                <Field
                  description={t("me.batchSizeHint")}
                  label={t("settings.batchSize")}
                  layout="row"
                >
                  <Input
                    max={20}
                    min={5}
                    onChange={(event) =>
                      update({ batchSize: Number(event.target.value) })
                    }
                    type="number"
                    value={settings.batchSize}
                  />
                </Field>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => downloadAiSettings(settings)}
                    size="sm"
                    variant="ghost"
                  >
                    <Icons.export />
                    {t("settings.exportAi")}
                  </Button>
                  <Button asChild size="sm" variant="ghost">
                    <label className="cursor-pointer">
                      <Icons.import />
                      {t("settings.importAi")}
                      <input
                        accept=".json,application/json"
                        className="sr-only"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) void importSettings(file);
                          event.target.value = "";
                        }}
                        type="file"
                      />
                    </label>
                  </Button>
                </div>
              </div>
            </details>
          </div>
        )}
      </div>
    </MeSection>
  );
}

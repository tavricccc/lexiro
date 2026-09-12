"use client";
import type { AiProvider, AiSettings } from "@/types";
import { useState } from "react";
import { toast } from "sonner";
import { MeSection } from "./me-section";
import { useAutosave } from "./use-autosave";
import { AiAdvancedSettings } from "./ai-advanced-settings";
import { AiConnectionTest } from "./ai-connection-test";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Icons } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { Switch } from "@/components/ui/switch";
import { t } from "@/lib/i18n";
import {
  downloadAiSettings,
  restoreAiSettings,
  parseAiSettingsJson,
  saveAiSettings,
  waitForAiSettingsPersistence,
} from "@/src/lib/ai-provider";
import {
  AI_MODELS,
  defaultModel,
  defaultProtocol,
  modelPreset,
} from "@/src/lib/ai/catalog";

const PROVIDERS = [
  { label: "OpenAI", value: "openai" },
  { label: "Anthropic", value: "anthropic" },
  { label: "Google Gemini", value: "google" },
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
  const [custom, setCustom] = useState(false);
  const [saveError, setSaveError] = useState("");
  const update = (patch: Partial<AiSettings>) =>
    onChange({ ...settings, ...patch });
  const missingKey = settings.enabled && !settings.apiKey.trim();
  const status = useAutosave(
    settings,
    async (value) => {
      try {
        saveAiSettings(value);
        await waitForAiSettingsPersistence();
        setSaveError("");
      } catch (reason) {
        setSaveError(
          reason instanceof Error ? reason.message : t("ai.invalidSettings"),
        );
      }
    },
    { ready: hydrated },
  );
  const presets = AI_MODELS.filter((m) => m.provider === settings.provider);
  const known = modelPreset(settings);
  const customSelected = custom || !known;
  const importSettings = async (file: File) => {
    try {
      const imported = parseAiSettingsJson(await file.text());
      const next = restoreAiSettings(imported, settings);
      onChange(next);
      saveAiSettings(next);
      await waitForAiSettingsPersistence();
      setCustom(false);
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
      status={saveError ? "idle" : status}
      title={t("settings.ai")}
    >
      <div className="grid gap-5">
        <div className="flex items-center justify-between gap-4 rounded-[var(--radius-card)] bg-[var(--surface-inset)] p-4">
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
        {saveError && (
          <p role="alert" className="text-sm text-destructive">
            {saveError}
          </p>
        )}
        {settings.enabled && (
          <div className="t-panel-reveal grid gap-5">
            <SelectField
              label={t("settings.provider")}
              onValueChange={(value) => {
                const provider = value as AiProvider;
                const model = defaultModel(provider);
                const preset = AI_MODELS.find(
                  (entry) => entry.provider === provider && entry.id === model,
                );
                setCustom(provider === "custom");
                update({
                  provider,
                  model,
                  protocol: defaultProtocol(provider),
                  baseUrl: "",
                  apiKey: "",
                  contextTokens: 0,
                  reasoningEffort: preset?.reasoningEffort ?? "",
                });
              }}
              options={PROVIDERS}
              value={settings.provider}
            />
            <SelectField
              label={t("ai.preset")}
              onValueChange={(id) => {
                if (id === "custom") {
                  setCustom(true);
                  update({ model: "", reasoningEffort: "" });
                  return;
                }
                setCustom(false);
                const preset = presets.find((m) => m.id === id)!;
                update({
                  model: id,
                  protocol: preset.protocol,
                  contextTokens: 0,
                  reasoningEffort: preset.reasoningEffort,
                });
              }}
              options={[
                ...presets.map((m) => ({ label: m.label, value: m.id })),
                { label: t("ai.customModel"), value: "custom" },
              ]}
              value={customSelected ? "custom" : settings.model}
            />
            {customSelected && (
              <Field
                label={t("ai.customModel")}
                description={t("ai.customModelHint")}
              >
                <Input
                  value={settings.model}
                  autoComplete="off"
                  onChange={(e) => update({ model: e.target.value })}
                />
              </Field>
            )}
            {customSelected ? (
              <Field
                label={t("ai.reasoningEffort")}
                description={t("ai.customReasoningHint")}
              >
                <Input
                  autoComplete="off"
                  placeholder={t("ai.reasoningPlaceholder")}
                  value={settings.reasoningEffort}
                  onChange={(event) =>
                    update({ reasoningEffort: event.target.value })
                  }
                />
              </Field>
            ) : known?.reasoningOptions ? (
              <SelectField
                label={t("ai.reasoningEffort")}
                description={t("ai.reasoningHint")}
                options={known.reasoningOptions.map((value) => ({
                  label: t(`ai.reasoning.${value}` as Parameters<typeof t>[0]),
                  value,
                }))}
                value={settings.reasoningEffort}
                onValueChange={(reasoningEffort) => update({ reasoningEffort })}
              />
            ) : (
              <p className="text-xs leading-5 text-muted-foreground">
                {t("ai.reasoningUnavailable")}
              </p>
            )}
            <Field
              error={missingKey && t("me.apiKeyRequired")}
              label={t("settings.apiKey")}
              description={t("ai.localKeyHint")}
            >
              <span className="relative block">
                <Input
                  autoComplete="off"
                  className="pr-12"
                  value={settings.apiKey}
                  type={showApiKey ? "text" : "password"}
                  onChange={(e) => update({ apiKey: e.target.value })}
                />
                <button
                  type="button"
                  aria-label={t(showApiKey ? "me.hideApiKey" : "me.showApiKey")}
                  className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-md focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => setShowApiKey((v) => !v)}
                >
                  {showApiKey ? (
                    <Icons.hide className="size-4" />
                  ) : (
                    <Icons.reveal className="size-4" />
                  )}
                </button>
              </span>
            </Field>
            {(settings.protocol === "responses" ||
              settings.protocol === "interactions") && (
              <p className="text-xs leading-5 text-muted-foreground">
                {t("ai.nativeContextHint")}
              </p>
            )}
            <AiAdvancedSettings settings={settings} update={update} />
            <AiConnectionTest settings={settings} />
            <div className="border-t pt-4">
              <p className="mb-3 text-xs font-medium text-muted-foreground">
                {t("ai.backupSettings")}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => {
                    try {
                      downloadAiSettings(settings);
                    } catch {
                      toast.error(t("ai.invalidSettings"));
                    }
                  }}
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
                      type="file"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void importSettings(file);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MeSection>
  );
}

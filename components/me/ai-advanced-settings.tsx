"use client";
import type { AiSettings, AiProtocol } from "@/src/types/ai";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { Switch } from "@/components/ui/switch";
import { AI_PROTOCOLS, endpoint, PROTOCOL_LABELS } from "@/src/lib/ai/catalog";
import { t } from "@/lib/i18n";

export function AiAdvancedSettings({
  settings,
  update,
}: {
  settings: AiSettings;
  update: (patch: Partial<AiSettings>) => void;
}) {
  return (
    <details className="rounded-[var(--radius-card)] border px-4 py-3.5 open:bg-[var(--surface-inset)]">
      <summary className="cursor-pointer text-sm font-medium">
        {t("ai.advancedTitle")}
      </summary>
      <div className="mt-5 grid gap-5 border-t pt-5">
        <SelectField
          label={t("ai.protocol")}
          description={t("ai.protocolHint")}
          value={settings.protocol}
          options={AI_PROTOCOLS.map((p) => ({
            label: PROTOCOL_LABELS[p],
            value: p,
          }))}
          onValueChange={(protocol) =>
            update({ protocol: protocol as AiProtocol })
          }
        />
        <Field
          label={t("settings.endpoint")}
          description={t("ai.endpointHint")}
        >
          <Input
            inputMode="url"
            autoComplete="off"
            value={settings.baseUrl}
            onChange={(e) => update({ baseUrl: e.target.value })}
            placeholder="https://…"
          />
        </Field>
        <div className="min-w-0 text-xs text-muted-foreground">
          <p>{t("ai.endpointPreview")}</p>
          <p className="mt-1 break-all font-mono leading-5">
            {endpoint(settings)}
          </p>
        </div>
        <Field label={t("ai.segmentSize")} description={t("ai.segmentHint")}>
          <Input
            min={1}
            max={50}
            type="number"
            value={settings.batchSize}
            onChange={(e) => update({ batchSize: Number(e.target.value) })}
          />
        </Field>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium">{t("ai.schemaLabel")}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {t("ai.schemaHint")}
            </p>
          </div>
          <Switch
            aria-label={t("ai.schemaLabel")}
            checked={settings.structuredOutput}
            onCheckedChange={(structuredOutput) => update({ structuredOutput })}
          />
        </div>
        <Field
          label={t("ai.contextLimit")}
          description={t("ai.contextLimitHint")}
        >
          <Input
            type="number"
            min={0}
            value={settings.contextTokens}
            onChange={(e) => update({ contextTokens: Number(e.target.value) })}
          />
        </Field>
        <Field
          label={t("ai.outputLimit")}
          description={t("ai.outputLimitHint")}
        >
          <Input
            type="number"
            min={256}
            value={settings.maxOutputTokens}
            onChange={(e) =>
              update({ maxOutputTokens: Number(e.target.value) })
            }
          />
        </Field>
      </div>
    </details>
  );
}

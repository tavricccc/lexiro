import { t } from "@/lib/i18n";

export interface AiDiagnosticValue {
  request?: string;
  response: string;
  responseId?: string;
}

function formatDiagnostic(value: string): string {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

export function AiDiagnostic({
  diagnostic,
}: {
  diagnostic: AiDiagnosticValue;
}) {
  return (
    <details open className="border-t pt-3 text-sm">
      <summary className="cursor-pointer font-medium">
        {t("ai.adminDiagnostic")}
      </summary>
      {diagnostic.responseId && (
        <p className="mt-3 break-all text-xs text-muted-foreground">
          {t("ai.adminResponseId", { id: diagnostic.responseId })}
        </p>
      )}
      {diagnostic.request && (
        <div className="mt-3">
          <p className="mb-1 font-medium">{t("ai.adminRequest")}</p>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-[var(--surface-inset)] p-3 text-xs">
            {formatDiagnostic(diagnostic.request)}
          </pre>
        </div>
      )}
      <div className="mt-3">
        <p className="mb-1 font-medium">{t("ai.adminResponse")}</p>
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-[var(--surface-inset)] p-3 text-xs">
          {formatDiagnostic(diagnostic.response)}
        </pre>
      </div>
    </details>
  );
}

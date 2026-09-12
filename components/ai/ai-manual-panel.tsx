"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Icons } from "@/components/ui/icons";
import { Textarea } from "@/components/ui/textarea";
import { t } from "@/lib/i18n";
import { copyToClipboard } from "@/src/lib/clipboard";

export function AiManualPanel({
  prompts,
  onResponse,
  error,
}: {
  prompts: string[];
  onResponse: (response: string, index: number) => boolean;
  error?: string;
}) {
  const [index, setIndex] = useState(0),
    [response, setResponse] = useState(""),
    [copied, setCopied] = useState(false),
    [copyError, setCopyError] = useState("");
  const step = Math.min(index, Math.max(0, prompts.length - 1));
  useEffect(() => {
    setIndex(0);
    setResponse("");
    setCopied(false);
  }, [prompts]);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);
  const copy = async () => {
    try {
      await copyToClipboard(prompts[step] ?? "");
      setCopied(true);
      setCopyError("");
    } catch (reason) {
      setCopyError(
        reason instanceof Error ? reason.message : t("ai.invalidReply"),
      );
    }
  };
  return (
    <div className="rule-t p-4 sm:p-5">
      <p className="type-lead">{t("ai.manualDescription")}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" onClick={() => void copy()}>
          {copied ? <Icons.success /> : <Icons.copy />}
          {t(copied ? "ai.copiedStep" : "ai.copyStep", {
            step: step + 1,
            total: prompts.length,
          })}
        </Button>
        <span className="text-xs tabular-nums text-muted-foreground">
          {t("ai.stepPosition", { step: step + 1, total: prompts.length })}
        </span>
      </div>
      <Field className="mt-4" label={t("ai.manualResponse")}>
        <Textarea
          className="min-h-36 font-mono text-xs"
          value={response}
          onChange={(e) => setResponse(e.target.value)}
        />
      </Field>
      <Button
        type="button"
        className="mt-3"
        variant="secondary"
        disabled={!response.trim()}
        onClick={() => {
          if (onResponse(response, step)) {
            setResponse("");
            if (step < prompts.length - 1) setIndex(step + 1);
          }
        }}
      >
        <Icons.success />
        {t("ai.applyStep", { step: step + 1 })}
      </Button>
      {(error || copyError) && (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {error || copyError}
        </p>
      )}
      <Link
        className="mt-5 inline-block text-xs underline underline-offset-4"
        href="/me"
      >
        {t("ai.switchToApi")}
      </Link>
    </div>
  );
}

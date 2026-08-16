"use client";

import { Check, Clipboard, Sparkles } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { generateWithSavedAi, type AiGenerationOptions } from "@/src/lib/ai-provider";
import { copyToClipboard } from "@/src/lib/clipboard";

export function AiActions({ prompt, responseFormat = "json", disabled, onResponse, onError }: { prompt: string; responseFormat?: NonNullable<AiGenerationOptions["responseFormat"]>; disabled?: boolean; onResponse: (response: string) => void; onError: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await copyToClipboard(prompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : String(reason));
    }
  };

  const call = async () => {
    setBusy(true);
    onError("");
    try {
      onResponse(await generateWithSavedAi(prompt, { responseFormat }));
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  return <div className="flex flex-wrap gap-2"><Button type="button" variant="secondary" disabled={disabled} onClick={() => void copy()}>{copied ? <Check className="size-4" /> : <Clipboard className="size-4" />}{t(copied ? "ai.copied" : "ai.copyPrompt")}</Button><Button type="button" disabled={disabled || busy} onClick={() => void call()}><Sparkles className="size-4" />{t(busy ? "ai.calling" : "ai.callApi")}</Button></div>;
}

"use client";
import { useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import type { AiSettings } from "@/types";
import { generateWithAi, isAiConfigured } from "@/src/lib/ai-provider";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { t } from "@/lib/i18n";

export function AiConnectionTest({ settings }: { settings: AiSettings }) {
  const abortRef = useRef<AbortController | null>(null);
  const mutation = useMutation({
    mutationFn: async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      const start = Date.now();
      await generateWithAi(settings, "Reply with only OK.", {
        signal: controller.signal,
        responseFormat: "text",
        maxOutputTokens: Math.min(settings.maxOutputTokens, 1024),
      });
      return Math.max(1, Math.round((Date.now() - start) / 1000));
    },
    retry: false,
  });
  const reset = mutation.reset;
  useEffect(() => {
    abortRef.current?.abort();
    reset();
    return () => abortRef.current?.abort();
  }, [
    settings.model,
    settings.apiKey,
    settings.baseUrl,
    settings.protocol,
    reset,
  ]);
  return (
    <div className="rounded-xl border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={
            !isAiConfigured(settings) ||
            mutation.isPending ||
            (settings.provider === "custom" && !settings.baseUrl.trim())
          }
          onClick={() => mutation.mutate()}
        >
          <Icons.ai />
          {t(mutation.isPending ? "ai.testing" : "ai.testConnection")}
        </Button>
        {mutation.isPending && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              abortRef.current?.abort();
              reset();
            }}
          >
            <Icons.cancel />
            {t("ai.stop")}
          </Button>
        )}
      </div>
      <div aria-live="polite" className="mt-3 text-xs leading-5">
        {mutation.isSuccess ? (
          <p className="flex items-center gap-1.5 text-primary">
            <Icons.success className="size-4" />
            {t("ai.testPassed")} · {t("ai.elapsed", { seconds: mutation.data })}
          </p>
        ) : mutation.isError ? (
          <p role="alert" className="text-destructive">
            {t("ai.testFailed")}：{mutation.error.message}
          </p>
        ) : (
          <p className="text-muted-foreground">{t("ai.testHint")}</p>
        )}
      </div>
    </div>
  );
}

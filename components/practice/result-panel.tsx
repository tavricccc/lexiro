"use client";

import { Bookmark, RotateCcw, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { generateWithAi } from "@/src/lib/ai-provider";
import { copyToClipboard } from "@/src/lib/clipboard";

export function ResultPanel({ correct, total, skipped, marked, wrongContent, onRetry, onRetryMarked, onContinueQuestions }: { correct: number; total: number; skipped: number; marked: number; wrongContent: string; onRetry: () => void; onRetryMarked?: () => void; onContinueQuestions?: () => void }) {
  const [explanation, setExplanation] = useState("");
  const [busy, setBusy] = useState(false);
  const explain = async () => {
    setBusy(true);
    try {
      const saved = JSON.parse(localStorage.getItem("lexiro-next-ai-settings") ?? "{}") as { mode?: string; provider?: string; model?: string; endpoint?: string };
      const prompt = t("practice.explanationPrompt", { content: wrongContent });
      if (saved.mode !== "api") { await copyToClipboard(prompt); setExplanation(t("practice.explanationCopied")); return; }
      const provider = (["openai", "anthropic", "google", "custom"].includes(saved.provider ?? "") ? saved.provider : "openai") as "openai" | "anthropic" | "google" | "custom";
      setExplanation(await generateWithAi({ enabled: true, provider, apiKey: localStorage.getItem("lexiro-next-ai-api-key") ?? "", baseUrl: saved.endpoint ?? "", model: saved.model ?? "gpt-5-mini", batchSize: 10 }, prompt, { responseFormat: "text" }));
    } catch (reason) { setExplanation(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  };
  return <div className="mx-auto max-w-xl py-12 text-center"><div className="mx-auto grid size-20 place-items-center rounded-full bg-muted text-3xl font-semibold text-foreground">{total ? Math.round(correct / total * 100) : 0}</div><h1 className="mt-6 text-3xl font-semibold">{t("practice.resultTitle")}</h1><p className="mt-2 text-muted-foreground">{t("practice.score", { correct, total })}</p><p className="mt-1 text-sm text-muted-foreground">{t("practice.skipped", { count: skipped })} · {t("practice.marked", { count: marked })}</p><div className="mt-7 flex flex-wrap justify-center gap-3">{onContinueQuestions ? <Button onClick={onContinueQuestions}>{t("practice.continueQuestions")}</Button> : <Button asChild><Link href="/">{t("practice.backHome")}</Link></Button>}{wrongContent && <><Button variant="secondary" onClick={onRetry}><RotateCcw className="size-4" />{t("practice.retryWrong")}</Button><Button variant="ghost" onClick={() => void explain()} disabled={busy}><Sparkles className="size-4" />{busy ? t("practice.explaining") : t("practice.explainWrong")}</Button></>}{onRetryMarked && <Button variant="secondary" onClick={onRetryMarked}><Bookmark className="size-4" />{t("practice.retryMarked")}</Button>}</div>{explanation && <section className="mt-8 rounded-xl bg-muted p-6 text-left"><h2 className="font-semibold">{t("practice.explanationTitle")}</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{explanation}</p></section>}</div>;
}

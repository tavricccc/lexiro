"use client";

import { Bookmark, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { AiActions } from "@/components/ai/ai-actions";
import { t } from "@/lib/i18n";
import { buildMistakeExplanationPrompt } from "@/src/lib/prompts";

export function ResultPanel({ correct, total, skipped, marked, wrongContent, onRetry, onRetryMarked, onContinueQuestions }: { correct: number; total: number; skipped: number; marked: number; wrongContent: string; onRetry: () => void; onRetryMarked?: () => void; onContinueQuestions?: () => void }) {
  const [explanation, setExplanation] = useState("");
  const [error, setError] = useState("");
  const prompt = buildMistakeExplanationPrompt(wrongContent);
  return <div className="mx-auto max-w-xl py-12 text-center"><div className="mx-auto grid size-20 place-items-center rounded-full bg-muted text-3xl font-semibold text-foreground">{total ? Math.round(correct / total * 100) : 0}</div><h1 className="mt-6 text-3xl font-semibold">{t("practice.resultTitle")}</h1><p className="mt-2 text-muted-foreground">{t("practice.score", { correct, total })}</p><p className="mt-1 text-sm text-muted-foreground">{t("practice.skipped", { count: skipped })} · {t("practice.marked", { count: marked })}</p><div className="mt-7 flex flex-wrap justify-center gap-3">{onContinueQuestions ? <Button onClick={onContinueQuestions}>{t("practice.continueQuestions")}</Button> : <Button asChild><Link href="/">{t("practice.backHome")}</Link></Button>}{wrongContent && <Button variant="secondary" onClick={onRetry}><RotateCcw className="size-4" />{t("practice.retryWrong")}</Button>}{onRetryMarked && <Button variant="secondary" onClick={onRetryMarked}><Bookmark className="size-4" />{t("practice.retryMarked")}</Button>}</div>{wrongContent && <div className="mt-5 flex justify-center"><AiActions prompt={prompt} responseFormat="text" onError={setError} onResponse={setExplanation} /></div>}{error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}{explanation && <section className="mt-8 rounded-[1.75rem] bg-muted p-6 text-left"><h2 className="font-semibold">{t("practice.explanationTitle")}</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{explanation}</p></section>}</div>;
}

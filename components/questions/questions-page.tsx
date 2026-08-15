"use client";

import { CircleHelp, Plus, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { t } from "@/lib/i18n";
import { useLibraryStore } from "@/stores/library-store";

export function QuestionsPage() {
  const { state, status, deleteQuestion } = useLibraryStore();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [difficulty, setDifficulty] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const questions = useMemo(() => state.questions.filter((question) => {
    const type = question.kind === "reading" ? "reading" : question.questionStyle;
    if (kind !== "all" && type !== kind) return false;
    if (difficulty !== "all" && question.difficulty !== Number(difficulty)) return false;
    const text = question.kind === "reading" ? `${question.title} ${question.passage}` : question.prompt;
    return text.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  }), [difficulty, kind, query, state.questions]);

  return <div>
    <PageHeader title={t("questions.title")} description={t("questions.description")} actions={<><Button asChild variant="ghost"><Link href="/questions/reading/new">{t("questions.newReading")}</Link></Button><Button asChild variant="secondary"><Link href="/questions/generate"><Sparkles className="size-4" />{t("questions.generate")}</Link></Button><Button asChild><Link href="/questions/new"><Plus className="size-4" />{t("questions.new")}</Link></Button></>} />
    <div className="flex flex-col gap-3 sm:flex-row"><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("questions.search")} /><select value={kind} onChange={(event) => setKind(event.target.value)} className="h-11 rounded-xl border bg-card px-3 text-sm"><option value="all">{t("questions.allTypes")}</option><option value="standard">{t("questions.standard")}</option><option value="fillBlank">{t("questions.fillBlank")}</option><option value="reading">{t("questions.reading")}</option></select><select value={difficulty} onChange={(event) => setDifficulty(event.target.value)} className="h-11 rounded-xl border bg-card px-3 text-sm"><option value="all">{t("questions.difficulty", { level: "—" })}</option>{[1,2,3].map((value) => <option key={value} value={value}>{t("questions.difficulty", { level: value })}</option>)}</select></div>
    {status === "ready" && questions.length === 0 && <div className="mt-12 border-y py-12 text-center"><CircleHelp className="mx-auto size-8 text-brand" /><h2 className="mt-4 text-xl font-semibold">{t("questions.empty")}</h2></div>}
    <div className="mt-6 divide-y border-y">{questions.map((question) => {
      const type = question.kind === "reading" ? t("questions.reading") : t(question.questionStyle === "fillBlank" ? "questions.fillBlank" : "questions.standard");
      const prompt = question.kind === "reading" ? question.title : question.prompt;
      return <article key={question.id} className="flex items-start gap-4 py-5"><div className="min-w-0 flex-1"><div className="flex flex-wrap gap-2 text-xs text-muted-foreground"><span className="font-semibold text-foreground">{type}</span><span>{t("questions.difficulty", { level: question.difficulty })}</span></div><Link href={question.kind === "reading" ? `/questions/reading/${question.id}/edit` : `/questions/${question.id}/edit`} className="mt-2 block font-medium leading-6 hover:text-foreground">{prompt}</Link></div><Button type="button" variant="ghost" size="icon" onClick={() => setDeleteTarget(question.id)} aria-label={t("questions.delete")}><Trash2 className="size-4" /></Button></article>;
    })}</div>
    <ConfirmDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }} title={t("questions.delete")} description={t("questions.deleteConfirm")} confirmLabel={t("questions.delete")} onConfirm={async () => { if (deleteTarget) await deleteQuestion(deleteTarget); setDeleteTarget(null); }} />
  </div>;
}

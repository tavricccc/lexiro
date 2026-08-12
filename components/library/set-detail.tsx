"use client";

import { ArrowLeft, BookOpenCheck, Download, Pencil, Sparkles, Trash2 } from "lucide-react";
import { strToU8, zipSync } from "fflate";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { t } from "@/lib/i18n";
import { useLibraryStore } from "@/stores/library-store";
import { useLearningStore } from "@/stores/learning-store";
import { isDue } from "@/src/lib/fsrs";
import { questionBelongsToMemberships } from "@/src/lib/question-ownership";

export function SetDetail({ setId }: { setId: string }) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { state, status, deleteSet } = useLibraryStore();
  const progress = useLearningStore((store) => store.progress);
  const current = state.sets.find((entry) => entry.id === setId);

  if (status !== "ready") return <div className="py-16 text-center text-sm text-ink-muted">{t("library.loading")}</div>;
  if (!current) return <div className="py-16 text-center"><h1 className="text-2xl font-semibold">{t("setDetail.notFound")}</h1><Button asChild variant="secondary" className="mt-6"><Link href="/library">{t("setDetail.back")}</Link></Button></div>;

  const words = (state.memberships[setId] ?? []).flatMap((membership) => {
    const word = state.words[membership.wordKey];
    if (!word) return [];
    return membership.senseIds.flatMap((senseId) => {
      const sense = word.senses.find((entry) => entry.id === senseId);
      return sense ? [{ word, sense }] : [];
    });
  });
  const memberships = state.memberships[setId] ?? [];
  const questions = state.questions.filter((question) => questionBelongsToMemberships(question, memberships));
  const learned = words.filter(({ sense }) => progress.cards[sense.id]).length;
  const due = words.filter(({ sense }) => progress.cards[sense.id] && isDue(progress.cards[sense.id])).length;

  const remove = async () => {
    setDeleting(true);
    await deleteSet(setId);
    router.push("/library");
  };
  const share = () => {
    const memberships = state.memberships[setId] ?? [];
    const wordKeys = new Set(memberships.map((entry) => entry.wordKey));
    const payload = { schemaVersion: 2, kind: "shared-set", exportedAt: new Date().toISOString(), set: current, memberships, words: Object.values(state.words).filter((word) => wordKeys.has(word.wordKey)), questions: state.questions.filter((question) => question.kind === "reading" ? question.questions.some((child) => wordKeys.has(child.wordKey)) : wordKeys.has(question.wordKey)) };
    const bytes = zipSync({ "lexiro-set.json": strToU8(JSON.stringify(payload)) }) as Uint8Array<ArrayBuffer>;
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/zip" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${current.setName}.lexiro.zip`; anchor.click(); URL.revokeObjectURL(url);
  };

  return (
    <div>
      <Link href="/library" className="mb-5 inline-flex items-center gap-2 text-sm text-ink-muted hover:text-ink"><ArrowLeft className="size-4" />{t("setDetail.back")}</Link>
      <PageHeader title={current.setName} description={t("setDetail.wordCount", { count: words.length })} actions={<><Button asChild><Link href={`/practice?set=${setId}`}><BookOpenCheck className="size-4" />{t("setDetail.start")}</Link></Button><Button asChild variant="secondary"><Link href={`/sets/${setId}/edit`}><Pencil className="size-4" />{t("setDetail.edit")}</Link></Button><Button type="button" variant="ghost" size="icon" onClick={share} aria-label={t("setDetail.share")}><Download className="size-4" /></Button><Button type="button" variant="ghost" size="icon" onClick={() => setConfirmDelete(true)} aria-label={t("setDetail.delete")}><Trash2 className="size-4" /></Button></>} />
      <div className="mb-9 flex flex-wrap gap-x-6 gap-y-2 border-y py-4 text-sm text-ink-muted"><span>{t("setDetail.learnedCount", { count: learned })}</span><span>{t("setDetail.dueCount", { count: due })}</span><span>{t("setDetail.questionCount", { count: questions.length })}</span><Button asChild variant="ghost" size="sm" className="ml-auto"><Link href={`/questions/generate?set=${setId}`}><Sparkles className="size-4" />{t("setDetail.generateQuestions")}</Link></Button></div>
      {words.length === 0 ? <div className="border-y py-12 text-center text-sm text-ink-muted">{t("setDetail.emptyWords")}</div> : (
        <div className="divide-y border-y">
          {words.map(({ word, sense }) => <article key={sense.id} className="grid gap-2 py-5 sm:grid-cols-[180px_100px_minmax(0,1fr)] sm:gap-5"><div className="text-lg font-semibold tracking-[-0.02em]">{word.word}</div><div className="text-sm font-medium text-brand-strong">{sense.pos}</div><div><div className="font-medium">{sense.meaningZh}</div>{sense.examples[0] && <p className="mt-2 text-sm leading-6 text-ink-muted">{sense.examples[0]}</p>}</div></article>)}
        </div>
      )}
      <section className="mt-12"><div className="flex items-center justify-between"><h2 className="text-xl font-semibold">{t("setDetail.questions")}</h2><Button asChild variant="secondary" size="sm"><Link href={`/practice?mode=questions&set=${setId}`}>{t("setDetail.start")}</Link></Button></div>{questions.length ? <div className="mt-4 divide-y border-y">{questions.map((question) => <Link key={question.id} href={question.kind === "reading" ? `/questions/reading/${question.id}/edit` : `/questions/${question.id}/edit`} className="block py-4 text-sm font-medium hover:text-brand-strong">{question.kind === "reading" ? question.title : question.prompt}</Link>)}</div> : <p className="mt-4 border-y py-7 text-sm text-ink-muted">{t("questions.empty")}</p>}</section>
      <ConfirmDialog open={confirmDelete} onOpenChange={setConfirmDelete} title={t("setDetail.delete")} description={t("setDetail.deleteConfirm", { name: current.setName })} confirmLabel={t("setDetail.delete")} busy={deleting} onConfirm={remove} />
    </div>
  );
}

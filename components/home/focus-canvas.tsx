"use client";

import { ArrowRight, BookOpenCheck, Brain } from "lucide-react";
import { motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { useLearningStore } from "@/stores/learning-store";
import { useLibraryStore } from "@/stores/library-store";
import { isDue } from "@/src/lib/fsrs";

export function FocusCanvas() {
  const library = useLibraryStore((store) => store.state);
  const cards = useLearningStore((store) => store.progress.cards);
  const reviewCount = Object.values(library.words).flatMap((word) => word.senses).filter((sense) => isDue(cards[sense.id] ?? null)).length;
  const questionCount = library.questions.length;
  const hasContent = Object.keys(library.words).length > 0;
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-[1.375rem] bg-brand-soft px-5 py-6 sm:px-7 sm:py-7 lg:px-8 lg:py-7"
    >
      <div className="relative z-10 max-w-2xl">
        <h1 className="max-w-xl text-balance text-[clamp(1.625rem,2.5vw,2.125rem)] font-semibold leading-[1.14] tracking-[-0.025em]">
          {t("home.greeting")}
        </h1>
        <p className="mt-3 max-w-lg text-sm leading-6 text-ink-muted">{t("home.summary", { review: reviewCount, questions: questionCount })}</p>

        <div className="mt-5 grid max-w-lg grid-cols-2 gap-2.5 sm:gap-3">
          <div className="flex items-center gap-2.5 rounded-2xl bg-surface/70 px-3 py-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand text-white"><Brain className="size-[1.125rem]" /></span>
            <div><div className="text-lg font-semibold tabular-nums leading-5">{reviewCount}</div><div className="mt-0.5 text-[0.6875rem] text-ink-muted">{t("home.reviewLabel")}</div></div>
          </div>
          <div className="flex items-center gap-2.5 rounded-2xl bg-surface/70 px-3 py-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand text-white"><BookOpenCheck className="size-[1.125rem]" /></span>
            <div><div className="text-lg font-semibold tabular-nums leading-5">{questionCount}</div><div className="mt-0.5 text-[0.6875rem] text-ink-muted">{t("home.questionLabel")}</div></div>
          </div>
        </div>

        <p className="mt-4 text-sm font-medium text-brand-strong">{t(reviewCount ? "home.recommendation" : questionCount ? "home.questionRecommendation" : "home.emptyRecommendation")}</p>
        <div className="mt-3 flex flex-wrap gap-2.5">
          <Button asChild><Link href={reviewCount ? "/practice?mode=review" : questionCount ? "/practice?mode=questions" : "/sets/new"}>{t(reviewCount ? "home.startReview" : questionCount ? "home.startQuestions" : "home.createFirstSet")}<ArrowRight className="size-4" /></Link></Button>
          <Button asChild variant="secondary"><Link href={hasContent ? "/practice?mode=questions" : "/dictionary"}>{t(hasContent ? "home.startQuestions" : "home.openDictionary")}</Link></Button>
        </div>
      </div>

      <Image aria-hidden="true" src="/illustrations/open-doodles-reading.svg" alt="" width={360} height={270} loading="eager" className="pointer-events-none absolute -bottom-4 right-0 hidden w-[27%] max-w-[18rem] opacity-30 lg:block" />
    </motion.section>
  );
}

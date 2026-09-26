import Link from "next/link";
import type { CardProgress, SenseId, WordKey, WordSense } from "@/types";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { t } from "@/lib/i18n";
import { isDue, isLeech } from "@/src/lib/fsrs";

export interface ViewWord { wordKey: WordKey; word: string; senses: WordSense[] }

export function SetWordRow({ entry, setId, cards }: { entry: ViewWord; setId: string; cards: Record<SenseId, CardProgress> }) {
  return <div>
    <div className="flex items-center justify-between gap-3"><p className="text-left text-base font-medium">{entry.word}</p><Button asChild variant="ghost" size="icon" aria-label={t("setDetail.edit")}><Link href={`/app/sets/${setId}/words/${encodeURIComponent(entry.wordKey)}/edit`}><Icons.edit /></Link></Button></div>
    <dl className="mt-2 grid gap-3">{entry.senses.map((sense) => {
      const card = cards[sense.id] ?? null;
      return <div key={sense.id}><dt className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-sm"><span className="text-muted-foreground">{sense.pos}</span><span className="font-medium">{sense.meaningZh}</span>{sense.supplementary && <span className="text-xs text-muted-foreground">{t("supplement.badge")}</span>}{card && isDue(card) && <span className="text-xs text-brand-600">{t("setDetail.dueBadge")}</span>}{isLeech(card) && <span className="text-xs text-destructive">{t("setDetail.leechBadge")}</span>}</dt><dd className="mt-1.5 grid gap-1">{sense.examples.map((example, index) => <p className="type-lead" key={index}>{example}</p>)}</dd></div>;
    })}</dl>
  </div>;
}

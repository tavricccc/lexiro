import { Dial } from "@/components/redesign/primitives";
import { useLearningStore } from "@/stores/learning-store";
import { familiarity } from "@/src/lib/learning-record";
import { Button } from "@/components/ui/button";
import Link from "@/components/ui/app-link";
import { BackControl } from "@/components/ui/back-control";
import { Icons } from "@/components/ui/icons";
import { EmptyState } from "@/components/ui/page-state";
import { PageHeader } from "@/components/ui/page-header";
import { SpeakPill } from "@/components/ui/speak-pill";
import { withReturnTo } from "@/lib/browse-routes";
import { t } from "@/lib/i18n";
import type { WordKey } from "@/types";
import { useLibraryStore } from "@/stores/library-store";
import { WordSenseCard } from "./set-word-row";

/** One word read in full, as in the app: every meaning in this set with all its examples. */
export function WordDetailPage({
  setId,
  wordKey: rawKey,
  returnHref,
}: {
  setId: string;
  wordKey: string;
  returnHref?: string;
}) {
  const record = useLearningStore(s => s.record);
  const state = useLibraryStore((store) => store.state);
  const wordKey = rawKey as WordKey;
  const word = state.words[wordKey];
  const membership = (state.memberships[setId] ?? []).find(
    (entry) => entry.wordKey === wordKey,
  );
  const senses = word?.senses.filter((sense) =>
    membership?.senseIds.includes(sense.id),
  );
  const backHref = returnHref ?? `/app/sets/${setId}`;
  const editHref = withReturnTo(
    `/app/sets/${setId}/words/${encodeURIComponent(wordKey)}/edit`,
    backHref,
  );

  if (!word || !senses?.length)
    return (
      <div className="word-detail">
        <PageHeader back={<BackControl href={backHref} />} title="" />
        <EmptyState
          variant="filtered"
          title={t("setDetail.missingWord")}
          description={t("setDetail.missingWordDescription")}
        />
      </div>
    );

  return (
    <div className="word-detail">
      <PageHeader
        back={<BackControl href={backHref} />}
        title=""
        actions={
          <Button asChild size="icon" variant="glass">
            <Link aria-label={t("setDetail.editWord")} href={editHref}>
              <Icons.edit />
            </Link>
          </Button>
        }
      />
      <div className="word-hero"><div className="rowx"><span className="chip">{state.sets.find(s => s.id === setId)?.setName}</span><Dial value={familiarity(record, senses.map(s => s.id))} /></div><div className="rowx">
        <h1 className="min-w-0 break-words font-latin text-[2.75rem] font-extrabold leading-[1.15] tracking-[-0.035em]">
          {word.word}
        </h1>
        <SpeakPill text={word.word} label={t("setDetail.speak")} />
      </div></div>
      <div className="split"><div className="stack">
        {senses.map((sense) => (
          <WordSenseCard key={sense.id} sense={sense} />
        ))}
      </div><aside className="tile word-record"><b>{t("redesign.records")}</b><div className="trio"><div><p className="fig">{senses.reduce((n, s) => n + (record.senses[s.id]?.answered ?? 0), 0)}</p><p>{t("redesign.answers")}</p></div><div><p className="fig">{senses.reduce((n, s) => n + (record.senses[s.id]?.correct ?? 0), 0)}</p><p>{t("redesign.correct")}</p></div></div></aside></div>
    </div>
  );
}

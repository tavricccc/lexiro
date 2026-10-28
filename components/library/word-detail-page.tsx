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
      <div className="mx-auto max-w-3xl">
        <PageHeader back={<BackControl href={backHref} />} title="" />
        <EmptyState
          variant="filtered"
          title={t("setDetail.missingWord")}
          description={t("setDetail.missingWordDescription")}
        />
      </div>
    );

  return (
    <div className="mx-auto max-w-3xl">
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
      <div className="mb-4 flex items-center gap-3.5">
        <h1 className="min-w-0 break-words text-[2.75rem] font-extrabold leading-[1.15] tracking-[-0.035em]">
          {word.word}
        </h1>
        <SpeakPill text={word.word} label={t("setDetail.speak")} />
      </div>
      <div className="grid gap-3">
        {senses.map((sense) => (
          <WordSenseCard key={sense.id} sense={sense} />
        ))}
      </div>
    </div>
  );
}

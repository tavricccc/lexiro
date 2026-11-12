import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Dialog } from "radix-ui";
import { useLearningStore } from "@/stores/learning-store";
import { Button } from "@/components/ui/button";
import Link from "@/components/ui/app-link";
import { Icons } from "@/components/ui/icons";
import { SetView } from "./set-view";
import { useAppRouter } from "@/lib/use-app-router";
import { holdRouteSheet } from "@/lib/navigation-memory";
import { EmptyState } from "@/components/ui/page-state";
import { SpeakPill } from "@/components/ui/speak-pill";
import { StarButton } from "@/components/ui/star-button";
import { SwipeableSheetContent } from "@/components/ui/bottom-sheet";
import { withReturnTo } from "@/lib/browse-routes";
import { t } from "@/lib/i18n";
import type { WordKey } from "@/types";
import { useLibraryStore } from "@/stores/library-store";
import { WordSenseCard } from "./set-word-row";

export function WordDetailSheet({
  setId,
  wordKey: rawKey,
  returnHref,
}: {
  setId: string;
  wordKey: string;
  returnHref?: string;
}) {
  const router = useAppRouter();
  const scroller = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement | null>(null);
  // Once the large word has scrolled under the top edge, the bar takes over
  // with a small centred title, as in an iOS large-title sheet.
  const [collapsed, setCollapsed] = useState(false);
  useLayoutEffect(holdRouteSheet, []);
  const record = useLearningStore((s) => s.record);
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
  useEffect(() => {
    const target = heading.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      ([entry]) => setCollapsed(!entry.isIntersecting),
      { root: scroller.current, rootMargin: "-8px 0px 0px 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  });
  const missing = !word || !senses?.length;
  const body = missing ? (
    <EmptyState
      variant="filtered"
      title={t("setDetail.missingWord")}
      description={t("setDetail.missingWordDescription")}
    />
  ) : (
    <>
      <div className="word-hero">
        <div className="between">
          <span className="chip">
            {state.sets.find((s) => s.id === setId)?.setName}
          </span>
          <StarButton wordKey={wordKey} />
        </div>
        <div className="rowx">
          <h1
            ref={heading}
            className="min-w-0 break-words font-latin text-[2.75rem] font-extrabold leading-[1.15] tracking-[-0.035em]"
          >
            {word.word}
          </h1>
          <SpeakPill text={word.word} label={t("setDetail.speak")} />
        </div>
      </div>
      <div className="split">
        <div className="stack">
          {senses.map((sense) => (
            <WordSenseCard key={sense.id} sense={sense} />
          ))}
        </div>
        <aside className="tile word-record">
          <b>{t("redesign.records")}</b>
          <div className="trio">
            <div>
              <p className="fig">
                {senses.reduce(
                  (n, s) => n + (record.senses[s.id]?.answered ?? 0),
                  0,
                )}
              </p>
              <p>{t("redesign.answers")}</p>
            </div>
            <div>
              <p className="fig">
                {senses.reduce(
                  (n, s) => n + (record.senses[s.id]?.correct ?? 0),
                  0,
                )}
              </p>
              <p>{t("redesign.correct")}</p>
            </div>
          </div>
        </aside>
      </div>
    </>
  );

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) router.push(backHref);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="scrim">
          <SwipeableSheetContent
            className="sheet-record word-detail"
            aria-describedby={undefined}
            onDismiss={() => router.push(backHref)}
          >
            <header
              className="record-bar"
              data-collapsed={collapsed || missing ? "" : undefined}
            >
              <Dialog.Title className="record-title">
                {word?.word ?? t("setDetail.missingWord")}
              </Dialog.Title>
              <div className="acts">
                {!missing && (
                  <>
                    <StarButton wordKey={wordKey} size="sm" />
                    <Button asChild size="icon" variant="glass">
                      <Link aria-label={t("setDetail.editWord")} href={editHref}>
                        <Icons.edit />
                      </Link>
                    </Button>
                  </>
                )}
                <Dialog.Close asChild>
                  <Button
                    aria-label={t("redesign.close")}
                    size="icon"
                    type="button"
                    variant="glass"
                  >
                    <Icons.cancel />
                  </Button>
                </Dialog.Close>
              </div>
            </header>
            <div className="record-scroll" ref={scroller}>
              {body}
            </div>
          </SwipeableSheetContent>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** One word read in full, as in the app: every meaning in this set with all its examples. */
export function WordDetailPage({
  setId,
  wordKey,
  returnHref,
}: {
  setId: string;
  wordKey: string;
  returnHref?: string;
}) {
  // The word is a layer over its set, not a page of its own: the set stays
  // underneath and the word opens as a sheet (a popup on wide screens).
  return (
    <>
      <SetView setId={setId} returnTo={returnHref} />
      <WordDetailSheet
        setId={setId}
        wordKey={wordKey}
        returnHref={returnHref}
      />
    </>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { BackControl } from "@/components/ui/back-control";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/page-state";
import { PageHeader } from "@/components/ui/page-header";
import { SignInRequired } from "@/components/ui/sign-in-required";
import { StepActions } from "@/components/ui/step-actions";
import { LibraryListSkeleton } from "@/components/ui/workspace-skeleton";
import { t } from "@/lib/i18n";
import { readSharedSet, type SharedSetView } from "@/lib/share-client";
import { copySharedSet } from "@/src/lib/set-share";
import { createUniqueSetName } from "@/src/lib/set-name";
import { useCloudStore } from "@/stores/cloud-store";
import { useLibraryStore } from "@/stores/library-store";

const PREVIEW_WORDS = 60;

/**
 * Someone else's set, read straight from their cloud copy. Nothing here is
 * stored until the reader saves it, and the saved copy is theirs to change.
 */
export function SharedSetPage({ shareId }: { shareId: string }) {
  const router = useRouter();
  const ready = useCloudStore((store) => store.ready);
  const uid = useCloudStore((store) => store.user?.uid);
  const library = useLibraryStore((store) => store.state);
  const libraryStatus = useLibraryStore((store) => store.status);
  const saveSet = useLibraryStore((store) => store.saveSet);
  const saveQuestion = useLibraryStore((store) => store.saveQuestion);
  const [view, setView] = useState<SharedSetView | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setView(null);
    setError("");
    if (!ready || !uid) return;
    const controller = new AbortController();
    readSharedSet(shareId, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setView(value);
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => controller.abort();
  }, [ready, shareId, uid]);

  const back = <BackControl href="/app/library" />;
  if (!ready) return <LibraryListSkeleton />;
  if (!uid)
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader back={back} title={t("share.pageTitle")} />
        <SignInRequired message={t("share.viewSignIn")} />
      </div>
    );
  if (error)
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader back={back} title={t("share.pageTitle")} />
        <EmptyState
          variant="filtered"
          title={t("share.loadFailed")}
          description={error}
        />
      </div>
    );
  if (!view) return <LibraryListSkeleton />;

  const { set } = view;
  const wordsByKey = new Map(set.words.map((word) => [word.wordKey, word]));
  const rows = set.memberships.flatMap((membership) => {
    const word = wordsByKey.get(membership.wordKey);
    if (!word) return [];
    const senses = word.senses.filter((sense) =>
      membership.senseIds.includes(sense.id),
    );
    return [{ key: membership.wordKey, word: word.word, senses }];
  });
  const senseCount = rows.reduce((count, row) => count + row.senses.length, 0);

  const save = async () => {
    setSaving(true);
    try {
      const setName = createUniqueSetName(
        set.setName,
        library.sets.map((entry) => entry.setName),
      );
      const imported = await copySharedSet(
        set,
        { setName },
        { saveSet, saveQuestion },
      );
      toast.success(t("share.saved", { name: imported.setName }));
      router.push(`/app/sets/${imported.id}`);
    } catch (reason) {
      toast.error(
        t("share.saveFailed", {
          message: reason instanceof Error ? reason.message : String(reason),
        }),
      );
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader back={back} title={set.setName} />
      <p className="-mt-2 mb-6 text-sm tabular-nums text-muted-foreground">
        {t("share.summary", {
          words: rows.length,
          senses: senseCount,
          questions: set.questions.length,
        })}
      </p>
      <ul className="divide-y rounded-[var(--radius-card)] bg-card">
        {rows.slice(0, PREVIEW_WORDS).map((row) => (
          <li key={row.key} className="px-4 py-3">
            <p className="font-medium">{row.word}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {row.senses
                .map((sense) => `${sense.pos} ${sense.meaningZh}`)
                .join("；")}
            </p>
          </li>
        ))}
      </ul>
      {rows.length > PREVIEW_WORDS && (
        <p className="mt-3 text-center text-sm text-muted-foreground">
          {t("share.more", { count: rows.length - PREVIEW_WORDS })}
        </p>
      )}
      <StepActions>
        {view.own ? (
          <>
            <p className="text-sm text-muted-foreground">{t("share.own")}</p>
            <Button asChild size="lg">
              <Link href={`/app/sets/${set.id}`}>{t("share.openOwn")}</Link>
            </Button>
          </>
        ) : (
          <Button
            size="lg"
            disabled={saving || libraryStatus !== "ready"}
            onClick={() => void save()}
          >
            {t(saving ? "share.saving" : "share.save")}
          </Button>
        )}
      </StepActions>
    </div>
  );
}

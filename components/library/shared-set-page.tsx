import { SpeakButton, SetGlyph, Dial } from "@/components/redesign/primitives";
import Link from "@/components/ui/app-link";
import { useAppRouter as useRouter } from "@/lib/use-app-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { BackControl } from "@/components/ui/back-control";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { EmptyState } from "@/components/ui/page-state";
import { PageHeader } from "@/components/ui/page-header";
import { SignInRequired } from "@/components/ui/sign-in-required";
import { StepActions } from "@/components/ui/step-actions";
import { LibraryListSkeleton } from "@/components/ui/workspace-skeleton";
import { t } from "@/lib/i18n";
import { readSharedSet, type SharedSetView } from "@/lib/share-client";
import { copySharedSet } from "@/src/lib/set-share";
import { compareWords } from "@/src/lib/library";
import { createUniqueSetName } from "@/src/lib/set-name";
import { useCloudStore } from "@/stores/cloud-store";
import { useLibraryStore } from "@/stores/library-store";



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
        <EmptyState variant="filtered" title={error} description="" />
      </div>
    );
  if (!view) return <LibraryListSkeleton />;

  const { set } = view;
  const wordsByKey = new Map(set.words.map((word) => [word.wordKey, word]));
  const rows = set.memberships
    .flatMap((membership) => {
      const word = wordsByKey.get(membership.wordKey);
      if (!word) return [];
      const senses = word.senses.filter((sense) =>
        membership.senseIds.includes(sense.id),
      );
      return [{ key: membership.wordKey, word: word.word, senses }];
    })
    .sort((a, b) => compareWords(a.word, b.word));


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
      <PageHeader back={back} title="" />
      <section className={`cover hue-${set.hue ?? "mint"}`}><div className="rowx"><SetGlyph set={set}/><h1>{set.setName}</h1></div><div className="hero-acts">{!view.own && <Button disabled={saving || libraryStatus !== "ready"} onClick={() => void save()}><Icons.saveCopy />{t("share.save")}</Button>}</div></section>
      <div className="sheet-list cols">{rows.map(row => <div className="w" key={row.key}><div className="head"><span className="hw font-latin">{row.word}</span><span className="pos">{row.senses[0]?.pos}</span><span className="zh">{row.senses[0]?.meaningZh}</span></div><Dial value={0}/><SpeakButton text={row.word}/></div>)}</div>
      <StepActions>
        {view.own ? (
          <>
            <p className="text-sm text-muted-foreground">{t("share.own")}</p>
            <Button asChild size="lg">
              <Link href={`/app/sets/${set.id}`}>
                <Icons.ownSet />
                {t("share.openOwn")}
              </Link>
            </Button>
          </>
        ) : null}
      </StepActions>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { AiRunPanel } from "@/components/ai/ai-run-panel";
import {
  useAiGeneration,
  useReviewHandoff,
  type AiGenerationSnapshot,
} from "@/components/ai/use-ai-generation";
import { useResumableDraft } from "@/components/ai/use-resumable-draft";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import {
  ListActionRow,
  ListCheckRow,
  ListPicker,
  ListSection,
} from "@/components/ui/list";
import { EmptyState, LoadingState } from "@/components/ui/page-state";
import { ResumeChoice } from "@/components/ui/resume-choice";
import { StepActions } from "@/components/ui/step-actions";
import { t } from "@/lib/i18n";
import { supplementTask } from "@/src/lib/ai/tasks";
import { setWordDrafts } from "@/src/lib/word-edit";
import { useLibraryStore } from "@/stores/library-store";
import { useCloudStore } from "@/stores/cloud-store";
import type { WordDraft, WordKey } from "@/types";

const LIMITS = [1, 2, 3] as const;
type Limit = (typeof LIMITS)[number];
interface SupplementDraft {
  chosen: WordKey[];
  limit: Limit;
  phase: "run" | "review";
  run?: AiGenerationSnapshot<WordDraft>;
}

/**
 * Asking for the meanings a set's words do not have yet.
 *
 * The number is a ceiling rather than a quota, and the screen says so in both
 * directions: the picker reads 最多, and a word that comes back with nothing
 * reports that it has no other meaning worth learning instead of looking like
 * a failure. Reading what came back is its own step, with the two ways onward
 * a reviewer actually wants: run it again, or keep it.
 */
export function SetSenseSupplement({ setId }: { setId: string }) {
  const uid = useCloudStore((store) => store.user?.uid);
  const saved = useResumableDraft<SupplementDraft>(
    `lexiro:flow-draft:v1:${uid ?? "local"}:supplement:${setId}`,
    { chosen: [], limit: 1, phase: "run" },
  );
  if (saved.status === "checking") return <LoadingState />;
  if (saved.status === "offer" || saved.status === "invalid")
    return (
      <ResumeChoice
        description={t(saved.status === "invalid" ? "draft.invalidDescription" : "draft.supplementDescription")}
        header={false}
        invalid={saved.status === "invalid"}
        onRestart={saved.restart}
        onResume={saved.resume}
      />
    );
  return <SupplementFlow setId={setId} draft={saved.draft} update={saved.update} clear={saved.clear} />;
}

function SupplementFlow({
  setId,
  draft,
  update,
  clear,
}: {
  setId: string;
  draft: SupplementDraft;
  update: (patch: Partial<SupplementDraft>) => void;
  clear: () => void;
}) {
  const router = useRouter();
  const state = useLibraryStore((store) => store.state);
  const { chosen, limit, phase } = draft;
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const generation = useAiGeneration<WordDraft>({
    initialSnapshot: draft.run,
    onSnapshotChange: (run) => update({ run }),
  });

  const words = useMemo(
    () =>
      (state.memberships[setId] ?? []).flatMap((membership) => {
        const word = state.words[membership.wordKey];
        if (!word) return [];
        const senses = word.senses.filter((sense) =>
          membership.senseIds.includes(sense.id),
        );
        return senses.length
          ? [{ wordKey: word.wordKey, word: word.word, senses }]
          : [];
      }),
    [setId, state.memberships, state.words],
  );

  const sources = useMemo(
    () =>
      words
        .filter((entry) => chosen.includes(entry.wordKey))
        .map((entry) => ({
          word: entry.word,
          existing: entry.senses.map((sense) => ({
            pos: sense.pos,
            meaningZh: sense.meaningZh,
          })),
        })),
    [chosen, words],
  );
  const task = useMemo(() => supplementTask(sources, limit), [limit, sources]);

  const { items, status } = generation.state;
  useReviewHandoff(status, () => update({ phase: "review" }));

  const save = async () => {
    const rows = items.flatMap((draft) =>
      draft.senses.map((sense) => ({
        word: draft.word,
        pos: sense.pos,
        meaningZh: sense.meaning,
        examples: sense.examples,
        supplementary: true,
      })),
    );
    const store = useLibraryStore.getState();
    const current = store.state.sets.find((entry) => entry.id === setId);
    if (!current) return;
    setSaving(true);
    try {
      await store.saveSet({
        id: setId,
        setName: current.setName,
        folderId: current.folderId,
        words: [...setWordDrafts(store.state, setId), ...rows],
      });
      clear();
      router.push(`/sets/${setId}`);
    } catch {
      setError(t("supplement.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  if (!words.length)
    return (
      <EmptyState
        description={t("setDetail.noWordsDescription")}
        title={t("supplement.empty")}
        variant="filtered"
      />
    );

  const running = status === "running";
  const allChosen = chosen.length === words.length;

  if (phase === "review")
    return (
      <fieldset disabled={saving} className="min-w-0 space-y-7">
        <ListSection header={t("supplement.resultsHeader")}>
          {items.map((draft) => (
            <SupplementResult draft={draft} key={draft.word} />
          ))}
        </ListSection>

        <p className="type-hint">{t("supplement.applyHint")}</p>
        <StepActions>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <Button
            className="w-full"
            disabled={saving || !items.some((draft) => draft.senses.length)}
            onClick={() => void save()}
            size="lg"
            type="button"
          >
            <Icons.success />
            {t("supplement.apply")}
          </Button>
          <Button
            disabled={saving}
            onClick={() => update({ phase: "run" })}
            type="button"
            variant="ghost"
          >
            <Icons.back />
            {t("ai.reviewBack")}
          </Button>
        </StepActions>
      </fieldset>
    );

  return (
    <div className="space-y-7">
      <p className="type-hint">{t("supplement.intro")}</p>

      <ListSection header={t("supplement.wordsHeader")}>
        {words.map((entry) => (
          <ListCheckRow
            checked={chosen.includes(entry.wordKey)}
            detail={t("supplement.existing", { count: entry.senses.length })}
            disabled={running}
            key={entry.wordKey}
            label={entry.word}
            onCheckedChange={(checked) =>
              update({
                chosen: checked
                  ? [...chosen, entry.wordKey]
                  : chosen.filter((key) => key !== entry.wordKey),
              })
            }
          />
        ))}
        <ListActionRow
          disabled={running}
          onClick={() =>
            update({ chosen: allChosen ? [] : words.map((entry) => entry.wordKey) })
          }
        >
          {t(allChosen ? "supplement.clearAll" : "supplement.selectAll")}
        </ListActionRow>
      </ListSection>

      <ListSection footer={t("supplement.limitFooter")}>
        <ListPicker
          disabled={running}
          label={t("supplement.limitHeader")}
          onChange={(value) => update({ limit: Number(value) as Limit })}
          options={LIMITS.map((value) => ({
            label: t("supplement.limitOption", { count: value }),
            value: String(value),
          }))}
          value={String(limit)}
        />
      </ListSection>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <AiRunPanel
        actionLabel={t("supplement.action")}
        billableCount={sources.length}
        configured={generation.configured}
        kind="senses"
        onCancel={generation.cancel}
        onResume={generation.resume}
        onReview={
          items.length && !running ? () => update({ phase: "review" }) : undefined
        }
        onStart={() => {
          setError("");
          generation.start(task);
        }}
        onTierChange={generation.setTier}
        ready={generation.ready}
        state={generation.state}
        tier={generation.tier}
        unit={t("supplement.unit")}
      />
    </div>
  );
}

/** One word's answer: what it gained, or that it had nothing to gain. */
function SupplementResult({ draft }: { draft: WordDraft }) {
  return (
    <div className="py-[var(--row-padding-block)]">
      <p className="type-row flex items-center gap-2">
        {draft.senses.length ? (
          <Icons.success aria-hidden className="size-[1.125rem] text-primary" />
        ) : null}
        {draft.word}
      </p>
      {draft.senses.length ? (
        <dl className="mt-1.5 grid gap-1.5">
          {draft.senses.map((sense) => (
            <div key={sense.id}>
              <dt className="flex flex-wrap items-baseline gap-x-2.5 text-sm">
                <span className="text-muted-foreground">{sense.pos}</span>
                <span className="font-medium">{sense.meaning}</span>
              </dt>
              {sense.examples.map((example) => (
                <dd className="type-hint" key={example}>
                  {example}
                </dd>
              ))}
            </div>
          ))}
        </dl>
      ) : (
        <p className="type-row-detail mt-0.5">{t("supplement.none")}</p>
      )}
    </div>
  );
}

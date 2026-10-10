"use client";

import Link from "next/link";
import type { LibrarySet, WordEntry } from "@/types";
import { BackControl } from "@/components/ui/back-control";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { SelectField } from "@/components/ui/select-field";
import { StepActions } from "@/components/ui/step-actions";
import { t } from "@/lib/i18n";
import { GeneratedQuestionResults } from "./generated-question-results";
import type { QuestionDraft } from "./question-generation-draft";

export function QuestionDraftRecovery({
  backHref,
  draft,
  error,
  fixedSet,
  onSetChange,
  onRetry,
  selectedSetId,
  sets,
  words,
}: {
  backHref: string;
  draft: QuestionDraft;
  error: string;
  fixedSet: boolean;
  onSetChange: (id: string) => void;
  onRetry: () => void;
  selectedSetId: string;
  sets: LibrarySet[];
  words: WordEntry[];
}) {
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        back={<BackControl href={backHref} />}
        title={t("questions.draftRecoveryTitle")}
      />
      <div className="mb-6 space-y-4">
        <p className="text-sm leading-6 text-muted-foreground">
          {t("questions.draftRecoveryKept", {
            count: draft.run?.state.items.length ?? 0,
          })}
        </p>
        <p className="text-sm leading-6 text-destructive" role="alert">
          {error}
        </p>
        <SelectField
          className="max-w-xl"
          description={t("questions.draftRecoveryHint")}
          disabled={fixedSet}
          label={t("questions.sourceSet")}
          onValueChange={onSetChange}
          options={sets.map((set) => ({ label: set.setName, value: set.id }))}
          placeholder={t("questions.selectSourceSet")}
          value={selectedSetId}
        />
        {selectedSetId && sets.some((set) => set.id === selectedSetId) && (
          <Button asChild size="sm" variant="outline">
            <Link href={`/app/sets/${selectedSetId}`}>
              <Icons.edit />
              {t("questions.checkSourceSet")}
            </Link>
          </Button>
        )}
      </div>
      <GeneratedQuestionResults
        items={draft.run?.state.items ?? []}
        words={words}
      />
      <StepActions width="wide">
        <Button
          disabled={!selectedSetId}
          onClick={onRetry}
          size="lg"
          type="button"
        >
          <Icons.success />
          {t("questions.rebindDraftSources")}
        </Button>
      </StepActions>
    </div>
  );
}

"use client";
import { useEffect, useRef, useState } from "react";
import { LIMITS, buildWordGenerationSources } from "@lexiro/ai-contract";
import { Button } from "@/components/ui/button";
import { CreditBadge } from "@/components/ai/credit-badge";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Icons } from "@/components/ui/icons";
import { StepActions } from "@/components/ui/step-actions";
import { ListActionRow, ListSection } from "@/components/ui/list";
import {
  managedFetch,
  managedTurn,
  readManagedStream,
} from "@/lib/managed-client";
import { encodeWordPhoto } from "@/lib/word-photo";
import { createAiSession } from "@/src/lib/ai/session";
import { parseOrganizedWordInput } from "@/src/lib/word-generation";
import { t } from "@/lib/i18n";
import { useCloudStore } from "@/stores/cloud-store";

export type OrganizerPhase = "input" | "review";

/**
 * Turning what was pasted or photographed into a list of words.
 *
 * What comes back is read on its own step rather than in a box under the
 * textarea that produced it: the list is the thing being corrected, and it is
 * long. The phase belongs to the caller so the page can say which step this is.
 */
export function InputOrganizer({
  onConfirm,
  onPhase,
  phase,
}: {
  onConfirm: (text: string) => void;
  onPhase: (phase: OrganizerPhase) => void;
  phase: OrganizerPhase;
}) {
  const [input, setInput] = useState("");
  const [review, setReview] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const uid = useCloudStore((store) => store.user?.uid);
  useEffect(() => () => controller.current?.abort(), [uid]);
  const organize = async (file?: File) => {
    const current = new AbortController();
    controller.current?.abort();
    controller.current = current;
    setBusy(true);
    setError("");
    try {
      let text: string;
      if (file) {
        const base64 = await encodeWordPhoto(file);
        current.signal.throwIfAborted();
        const response = await managedFetch("/organize", {
          method: "POST",
          headers: {
            "content-type": "text/plain",
            "x-session-id": crypto.randomUUID(),
          },
          body: base64,
          signal: current.signal,
        });
        text = (await readManagedStream(response, { signal: current.signal }))
          .text;
      } else {
        text = (
          await managedTurn(
            createAiSession("lite", input),
            { kind: "organizeText", raw: input },
            { signal: current.signal },
          )
        ).text;
      }
      current.signal.throwIfAborted();
      const cleaned = parseOrganizedWordInput(text).join("\n");
      if (!cleaned.trim()) throw new Error(t("managed.noWordsRecognized"));
      setReview(cleaned);
      onPhase("review");
    } catch (reason) {
      if (!current.signal.aborted)
        setError(
          reason instanceof Error ? reason.message : t("managed.failed"),
        );
    } finally {
      if (controller.current === current) setBusy(false);
    }
  };
  const confirm = () => {
    const sources = buildWordGenerationSources(review);
    if (
      !sources.length ||
      sources.some((source) => source.raw.length > LIMITS.source)
    ) {
      setError(t("managed.inputLimit"));
      return;
    }
    onConfirm(review);
  };

  if (phase === "review")
    return (
      <div className="space-y-7">
        <Field label={t("managed.reviewLines")} hint={t("managed.reviewHint")}>
          <Textarea
            className="min-h-64"
            maxLength={LIMITS.input}
            onChange={(event) => setReview(event.target.value)}
            value={review}
          />
        </Field>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <StepActions width="wide">
          <Button
            className="w-full"
            disabled={!review.trim()}
            onClick={confirm}
            size="lg"
            type="button"
          >
            <Icons.next />
            {t("managed.confirmList")}
          </Button>
          <Button
            onClick={() => onPhase("input")}
            type="button"
            variant="ghost"
          >
            <Icons.back />
            {t("managed.reorganize")}
          </Button>
        </StepActions>
      </div>
    );

  return (
    <div className="space-y-4">
      <Field label={t("setEditor.rawWords")}>
        <Textarea
          value={input}
          maxLength={LIMITS.input}
          disabled={busy}
          placeholder={t("setEditor.rawWordsPlaceholder")}
          onChange={(event) => setInput(event.target.value)}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          aria-label={t("managed.organize")}
          type="button"
          disabled={busy || !input.trim() || !uid}
          onClick={() => void organize()}
        >
          <Icons.generate />
          {t("managed.organize")}
          <CreditBadge
            label={t("managed.expectedPoints", { points: 5 })}
            value={t("managed.expectedShort", { points: 5 })}
          />
        </Button>
        <Button
          asChild
          type="button"
          variant="secondary"
          disabled={busy || !uid}
        >
          <label>
            <Icons.import />
            {t("managed.photo")}
            <CreditBadge
              label={t("managed.expectedPoints", { points: 6 })}
              value={t("managed.expectedShort", { points: 6 })}
            />
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={busy || !uid}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void organize(file);
              }}
            />
          </label>
        </Button>
        {busy && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => controller.current?.abort()}
          >
            {t("ai.stop")}
          </Button>
        )}
      </div>
      {!uid && (
        <p className="text-sm text-muted-foreground">
          {t("managed.signInRequired")}
        </p>
      )}
      {busy && (
        <p role="status" className="text-sm text-muted-foreground">
          {t("ai.generating")}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {review && (
        <ListSection>
          <ListActionRow onClick={() => onPhase("review")}>
            {t("ai.viewResults")}
          </ListActionRow>
        </ListSection>
      )}
    </div>
  );
}

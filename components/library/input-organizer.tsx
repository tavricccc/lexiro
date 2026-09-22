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
import { AiRequestError } from "@/src/lib/ai/errors";
import { createAiSession } from "@/src/lib/ai/session";
import { parseOrganizedWordInput } from "@/src/lib/word-generation";
import { t } from "@/lib/i18n";
import { useCloudStore } from "@/stores/cloud-store";

export type OrganizerPhase = "input" | "review";

function formatPhotoError(name: string, reason: unknown) {
  const detail =
    reason instanceof AiRequestError && reason.code === "invalid_image"
      ? t("managed.imageRejected")
      : reason instanceof Error
        ? reason.message
        : t("managed.imageInvalid");
  return t("managed.photoError", { file: name, detail });
}

function PhotoInputButton({
  disabled,
  label,
  onFiles,
}: {
  disabled: boolean;
  label: string;
  onFiles: (files: File[]) => void;
}) {
  return (
    <Button asChild type="button" variant="secondary" disabled={disabled}>
      <label>
        <Icons.import />
        {label}
        <CreditBadge
          label={t("managed.photoPoints")}
          value={t("managed.photoPointsShort")}
        />
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          disabled={disabled}
          multiple
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            if (files.length) onFiles(files);
          }}
        />
      </label>
    </Button>
  );
}

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
  const [addingPhotos, setAddingPhotos] = useState(false);
  const [photoProgress, setPhotoProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const controller = useRef<AbortController | null>(null);
  const uid = useCloudStore((store) => store.user?.uid);
  useEffect(() => () => controller.current?.abort(), [uid]);

  const startRun = () => {
    const current = new AbortController();
    controller.current?.abort();
    controller.current = current;
    setBusy(true);
    setError("");
    return current;
  };

  const organizeText = async () => {
    const current = startRun();
    try {
      const text = (
        await managedTurn(
          createAiSession("lite", input),
          { kind: "organizeText", raw: input },
          { signal: current.signal },
        )
      ).text;
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

  const organizePhotos = async (files: File[]) => {
    const current = startRun();
    const organized: string[] = [];
    try {
      for (
        let batchStart = 0;
        batchStart < files.length;
        batchStart += LIMITS.images
      ) {
        const batch = files.slice(batchStart, batchStart + LIMITS.images);
        const images: string[] = [];
        setPhotoProgress({
          current: batchStart / LIMITS.images + 1,
          total: Math.ceil(files.length / LIMITS.images),
        });
        for (const file of batch) {
          try {
            current.signal.throwIfAborted();
            images.push(await encodeWordPhoto(file));
            current.signal.throwIfAborted();
          } catch (reason) {
            if (!current.signal.aborted) setError(formatPhotoError(file.name, reason));
            return;
          }
        }
        try {
          const response = await managedFetch("/organize", {
            method: "POST",
            headers: {
              "content-type": "text/plain",
              "x-session-id": crypto.randomUUID(),
            },
            body: images.join("\n"),
            signal: current.signal,
          });
          const text = (await readManagedStream(response, { signal: current.signal })).text;
          current.signal.throwIfAborted();
          const cleaned = parseOrganizedWordInput(text).join("\n");
          if (!cleaned.trim()) throw new Error(t("managed.noWordsRecognized"));
          organized.push(cleaned);
        } catch (reason) {
          if (!current.signal.aborted) setError(formatPhotoError(
            t("managed.photoBatch", { start: batchStart + 1, end: batchStart + batch.length }), reason,
          ));
          return;
        }
      }
    } finally {
      if (controller.current === current) {
        if (organized.length) {
          setReview((currentReview) => [currentReview, ...organized].filter(Boolean).join("\n"));
          setAddingPhotos(true);
        }
        setBusy(false);
        setPhotoProgress(null);
      }
    }
  };

  const confirm = () => {
    const sources = buildWordGenerationSources(review);
    if (
      !sources.length ||
      review.length > LIMITS.input ||
      sources.length > LIMITS.sources ||
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
            {t(addingPhotos ? "managed.backToPhotos" : "managed.reorganize")}
          </Button>
        </StepActions>
      </div>
    );

  return (
    <div className="space-y-4">
      {addingPhotos ? (
        <div className="space-y-3">
          <p className="font-medium">{t("managed.morePhotosQuestion")}</p>
          <p className="text-sm text-muted-foreground">
            {t("managed.morePhotosHint")}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <PhotoInputButton
              disabled={busy || !uid}
              label={t("managed.addPhotos")}
              onFiles={(files) => void organizePhotos(files)}
            />
            <Button
              disabled={busy}
              onClick={() => onPhase("review")}
              type="button"
            >
              <Icons.next />
              {t("managed.noMorePhotos")}
            </Button>
          </div>
        </div>
      ) : (
        <>
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
              onClick={() => void organizeText()}
            >
              <Icons.generate />
              {t("managed.organize")}
              <CreditBadge
                label={t("managed.expectedPoints", { points: 5 })}
                value={t("managed.expectedShort", { points: 5 })}
              />
            </Button>
            <PhotoInputButton
              disabled={busy || !uid}
              label={t("managed.photo")}
              onFiles={(files) => void organizePhotos(files)}
            />
          </div>
        </>
      )}
      {busy && (
        <Button
          type="button"
          variant="ghost"
          onClick={() => controller.current?.abort()}
        >
          {t("ai.stop")}
        </Button>
      )}
      {!uid && (
        <p className="text-sm text-muted-foreground">
          {t("managed.signInRequired")}
        </p>
      )}
      {busy && (
        <p role="status" className="text-sm text-muted-foreground">
          {photoProgress
            ? t("managed.photoProgress", photoProgress)
            : t("ai.generating")}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="whitespace-pre-wrap break-words text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {!addingPhotos && review && (
        <ListSection>
          <ListActionRow onClick={() => onPhase("review")}>
            {t("ai.viewResults")}
          </ListActionRow>
        </ListSection>
      )}
    </div>
  );
}

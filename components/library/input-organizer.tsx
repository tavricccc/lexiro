"use client";
import { useEffect, useRef, useState } from "react";
import {
  LIMITS,
  buildWordGenerationSources,
  estimatePoints,
  type AiModel,
  type Tier,
  type TokenUsage,
} from "@lexiro/ai-contract";
import { GenerationControls } from "@/components/ai/generation-controls";
import { AiUsage } from "@/components/ai/ai-usage";
import {
  AiDiagnostic,
  type AiDiagnosticValue,
} from "@/components/ai/ai-diagnostic";
import { useManagedAccount } from "@/components/ai/use-managed-account";
import { useTokenRate } from "@/components/ai/use-token-rate";
import { TaskProgress } from "@/components/ui/task-progress";
import { Button } from "@/components/ui/button";
import { CreditBadge } from "@/components/ai/credit-badge";
import {
  PhotoInputButton,
  PhotoRunProgress,
  PhotoSelection,
  type PhotoProgressState,
} from "@/components/library/photo-organization-ui";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Icons } from "@/components/ui/icons";
import { StepActions } from "@/components/ui/step-actions";
import {
  managedGeneration,
  managedTurn,
  readManagedStream,
  addUsage,
} from "@/lib/managed-client";
import { encodeWordPhoto } from "@/lib/word-photo";
import { AiRequestError } from "@/src/lib/ai/errors";
import { createAiSession } from "@/src/lib/ai/session";
import { parseOrganizedWordInput } from "@/src/lib/word-generation";
import { t } from "@/lib/i18n";
import { useCloudStore } from "@/stores/cloud-store";
import { useAiPreferencesStore } from "@/stores/ai-preferences-store";

export type OrganizerPhase = "input" | "review";
export interface InputOrganizerDraft {
  input: string;
  review: string;
  addingPhotos: boolean;
  model?: AiModel;
  tier?: Tier;
}

function formatPhotoError(name: string, reason: unknown) {
  const detail =
    reason instanceof AiRequestError && reason.code === "invalid_image"
      ? t("managed.imageRejected")
      : reason instanceof Error
        ? reason.message
        : t("managed.imageInvalid");
  return t("managed.photoError", { file: name, detail });
}

/**
 * Turning what was pasted or photographed into a list of words.
 *
 * What comes back is read on its own step rather than in a box under the
 * textarea that produced it: the list is the thing being corrected, and it is
 * long. The phase belongs to the caller so the page can say which step this is.
 */
export function InputOrganizer({
  initialDraft,
  onDraftChange,
  onConfirm,
  onPhase,
  phase,
}: {
  initialDraft?: InputOrganizerDraft;
  onDraftChange?: (draft: InputOrganizerDraft) => void;
  onConfirm: (text: string) => void;
  onPhase: (phase: OrganizerPhase) => void;
  phase: OrganizerPhase;
}) {
  const [input, setInput] = useState(initialDraft?.input ?? "");
  const [review, setReview] = useState(initialDraft?.review ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [addingPhotos, setAddingPhotos] = useState(
    initialDraft?.addingPhotos ?? false,
  );
  const [pendingPhotos, setPendingPhotos] = useState<File[] | null>(null);
  const [nextBatchStart, setNextBatchStart] = useState(0);
  const [photoProgress, setPhotoProgress] = useState<PhotoProgressState | null>(
    null,
  );
  const [now, setNow] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [tokens, setTokens] = useState(0);
  const tokenRate = useTokenRate(tokens, busy, startedAt);
  const controller = useRef<AbortController | null>(null);
  const textSession = useRef<ReturnType<typeof createAiSession> | null>(null);
  const photoSessions = useRef(new Map<number, ReturnType<typeof createAiSession>>());
  const onDraftRef = useRef(onDraftChange);
  onDraftRef.current = onDraftChange;
  const firstDraft = useRef(true);
  const preferredModel = useAiPreferencesStore((store) => store.preferences.model);
  const [modelOverride, setChosenModel] = useState<AiModel | undefined>(initialDraft?.model);
  const chosenModel = modelOverride ?? preferredModel;
  const [tier, setTier] = useState<Tier>(initialDraft?.tier ?? "lite");
  useEffect(() => {
    if (firstDraft.current) {
      firstDraft.current = false;
      return;
    }
    onDraftRef.current?.({
      input,
      review,
      addingPhotos,
      model: chosenModel,
      tier,
    });
  }, [input, review, addingPhotos, chosenModel, tier]);
  const uid = useCloudStore((store) => store.user?.uid);
  const account = useManagedAccount();
  const admin = account.data?.admin === true;
  const [usage, setUsage] = useState<TokenUsage | null>(null);
  const [diagnostic, setDiagnostic] = useState<AiDiagnosticValue | null>(null);
  const textCost = estimatePoints("organizeText", 1, tier, chosenModel).max;
  useEffect(() => () => controller.current?.abort(), [uid]);
  useEffect(() => {
    if (!busy) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [busy]);

  const startRun = (keepUsage = false) => {
    const current = new AbortController();
    controller.current?.abort();
    controller.current = current;
    setBusy(true);
    setStartedAt(Date.now());
    setTokens(0);
    setError("");
    setDiagnostic(null);
    if (!keepUsage) setUsage({});
    return current;
  };

  const recordUsage = (value: TokenUsage | undefined) => {
    if (value) setUsage((total) => addUsage({ ...total }, value));
  };
  const recordFailure = (
    reason: unknown,
    request: string,
    reply?: { text: string; id?: string },
  ) => {
    if (reason instanceof AiRequestError) recordUsage(reason.usage);
    setDiagnostic({
      request,
      response:
        reply?.text ??
        (reason instanceof AiRequestError ? reason.debugMessage : undefined) ??
        (reason instanceof Error ? reason.message : String(reason)),
      responseId: reply?.id,
    });
  };
  const adminPanel = admin && (
    <>
      {usage && <AiUsage usage={usage} />}
      {error && diagnostic && <AiDiagnostic diagnostic={diagnostic} />}
    </>
  );
  const controls = (
    <GenerationControls
      count={pendingPhotos ? pendingPhotos.length - nextBatchStart : 1}
      disabled={busy}
      kind={pendingPhotos || addingPhotos ? "organizeImage" : "organizeText"}
      model={chosenModel}
      onModelChange={setChosenModel}
      onTierChange={setTier}
      tier={tier}
    />
  );

  const organizeText = async () => {
    const current = startRun();
    const session = textSession.current?.pendingTurn && textSession.current.context === input && textSession.current.model === chosenModel && textSession.current.tier === tier
      ? textSession.current : createAiSession(tier, input, chosenModel);
    textSession.current = session;
    let reply: Awaited<ReturnType<typeof managedTurn>> | undefined;
    try {
      reply = await managedTurn(
        session,
        { kind: "organizeText", raw: input },
        { signal: current.signal, onTokens: setTokens, onBatchStartedAt: setStartedAt },
      );
      recordUsage(reply.usage);
      current.signal.throwIfAborted();
      const cleaned = parseOrganizedWordInput(reply.text).join("\n");
      if (!cleaned.trim()) throw new Error(t("managed.noWordsRecognized"));
      setReview(cleaned);
      onPhase("review");
    } catch (reason) {
      recordFailure(
        reason,
        JSON.stringify({
          kind: "organizeText",
          raw: input,
          model: chosenModel,
          tier,
          session: session.sessionId,
        }),
        reply,
      );
      if (!current.signal.aborted)
        setError(
          reason instanceof Error ? reason.message : t("managed.failed"),
        );
    } finally {
      if (controller.current === current) setBusy(false);
    }
  };

  const selectPhotos = (files: File[]) => {
    setPendingPhotos(files);
    setNextBatchStart(0);
    setError("");
  };

  const cancelPhotoSelection = () => {
    setPendingPhotos(null);
    setNextBatchStart(0);
    setError("");
  };

  const removePhoto = (index: number) => {
    if (!pendingPhotos) return;
    if (pendingPhotos.length - nextBatchStart === 1) {
      cancelPhotoSelection();
      return;
    }
    setPendingPhotos(pendingPhotos.filter((_, at) => at !== index));
    setError("");
  };

  const organizePhotos = async () => {
    const files = pendingPhotos;
    if (!files || busy) return;
    const current = startRun(nextBatchStart > 0);
    const totalBatches = Math.ceil(files.length / LIMITS.images);
    const startedAt = Date.now();
    const model = chosenModel;
    try {
      for (
        let batchStart = nextBatchStart;
        batchStart < files.length;
        batchStart += LIMITS.images
      ) {
        const batch = files.slice(batchStart, batchStart + LIMITS.images);
        const images: string[] = [];
        setPhotoProgress({
          phase: "preparing",
          completed: Math.floor(batchStart / LIMITS.images),
          total: totalBatches,
          currentBatch: Math.floor(batchStart / LIMITS.images) + 1,
          prepared: 0,
          batchSize: batch.length,
          characters: 0,
          startedAt,
        });
        for (const file of batch) {
          try {
            current.signal.throwIfAborted();
            images.push(await encodeWordPhoto(file));
            current.signal.throwIfAborted();
            setPhotoProgress(
              (progress) =>
                progress && { ...progress, prepared: images.length },
            );
          } catch (reason) {
            if (!current.signal.aborted)
              setError(formatPhotoError(file.name, reason));
            return;
          }
        }
        let reply: Awaited<ReturnType<typeof readManagedStream>> | undefined;
        const photoSession = photoSessions.current.get(batchStart) ?? createAiSession(tier, "photos", model);
        photoSessions.current.set(batchStart, photoSession);
        const session = photoSession.sessionId;
        setTokens(0);
        setStartedAt(Date.now());
        try {
          setPhotoProgress(
            (progress) => progress && { ...progress, phase: "organizing" },
          );
          reply = await managedGeneration(photoSession, "/organize", {
            method: "POST",
            headers: {
              "content-type": "text/plain",
              "x-session-id": session,
              "x-ai-model": model,
              "x-ai-tier": tier,
            },
            body: images.join("\n"),
            signal: current.signal,
          }, {
            signal: current.signal,
            onTokens: setTokens,
            onBatchStartedAt: setStartedAt,
            onCharacters: (characters) =>
              setPhotoProgress((progress) =>
                controller.current === current && progress
                  ? { ...progress, characters }
                  : progress,
              ),
          });
          recordUsage(reply.usage);
          photoSessions.current.delete(batchStart);
          current.signal.throwIfAborted();
          const cleaned = parseOrganizedWordInput(reply.text).join("\n");
          if (!cleaned.trim()) throw new Error(t("managed.noWordsRecognized"));
          setReview((currentReview) =>
            [currentReview, cleaned].filter(Boolean).join("\n"),
          );
          setAddingPhotos(true);
          setNextBatchStart(batchStart + batch.length);
          setPhotoProgress(
            (progress) =>
              progress && {
                ...progress,
                completed: Math.floor(batchStart / LIMITS.images) + 1,
              },
          );
        } catch (reason) {
          recordFailure(
            reason,
            JSON.stringify({
              kind: "organizeImage",
              images: batch.length,
              model,
              tier,
              session,
            }),
            reply,
          );
          if (!current.signal.aborted)
            setError(
              formatPhotoError(
                t("managed.photoBatch", {
                  start: batchStart + 1,
                  end: batchStart + batch.length,
                }),
                reason,
              ),
            );
          return;
        }
      }
      setPendingPhotos(null);
      setNextBatchStart(0);
    } finally {
      if (controller.current === current) {
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
      sources.some((source) => source.raw.length > LIMITS.source)
    ) {
      setError(t("managed.reviewLimit"));
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
        {adminPanel}
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

  if (pendingPhotos && !busy)
    return (
      <div className="space-y-4">
        {controls}
        {adminPanel}
        <PhotoSelection
          error={error}
          files={pendingPhotos}
          onCancel={cancelPhotoSelection}
          onConfirm={() => void organizePhotos()}
          onRemove={removePhoto}
          onReplace={selectPhotos}
          processed={nextBatchStart}
          model={chosenModel}
          tier={tier}
          admin={admin}
        />
      </div>
    );

  if (photoProgress && busy)
    return (
      <div className="space-y-7">
        {controls}
        <PhotoRunProgress
          tokenRate={tokenRate}
          progress={photoProgress}
          seconds={Math.max(
            0,
            Math.floor((now - photoProgress.startedAt) / 1000),
          )}
        />
        {adminPanel}
        <StepActions width="wide">
          <Button
            className="w-full"
            onClick={() => controller.current?.abort()}
            type="button"
            variant="outline"
          >
            <Icons.cancel />
            {t("ai.stop")}
          </Button>
        </StepActions>
      </div>
    );

  return (
    <div className="space-y-4">
      {controls}
      {addingPhotos ? (
        <div className="space-y-3">
          <p className="font-medium">{t("managed.morePhotosQuestion")}</p>
          <p className="text-sm text-muted-foreground">
            {t("managed.morePhotosHint")}
          </p>
        </div>
      ) : (
        <Field label={t("setEditor.rawWords")}>
          <Textarea
            value={input}
            maxLength={LIMITS.input}
            disabled={busy}
            placeholder={t("setEditor.rawWordsPlaceholder")}
            onChange={(event) => setInput(event.target.value)}
          />
        </Field>
      )}
      {adminPanel}
      {busy && !photoProgress && (
        <TaskProgress
          elapsed={t("ai.elapsed", {
            seconds: Math.max(0, Math.floor((now - startedAt) / 1000)),
          })}
          label={t("managed.photoProgressLabel")}
          max={1}
          summary={t("ai.generating")}
          title={t("managed.organize")}
          value={0}
        >
          <span className="tabular-nums">
            {t("ai.progressTps", { rate: tokenRate.toFixed(1) })}
          </span>
        </TaskProgress>
      )}
      <StepActions width="wide">
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
          <p
            role="alert"
            className="whitespace-pre-wrap break-words text-sm text-destructive"
          >
            {error}
          </p>
        )}
        {busy ? (
          <Button
            className="w-full"
            type="button"
            variant="outline"
            onClick={() => controller.current?.abort()}
          >
            {t("ai.stop")}
          </Button>
        ) : addingPhotos ? (
          <>
            <Button
              className="w-full"
              onClick={() => onPhase("review")}
              type="button"
              size="lg"
            >
              <Icons.next />
              {t("managed.noMorePhotos")}
            </Button>
            <PhotoInputButton
              model={chosenModel}
              tier={tier}
              showCost={!admin}
              disabled={!uid}
              label={t("managed.addPhotos")}
              onFiles={selectPhotos}
            />
          </>
        ) : (
          <>
            <Button
              className="w-full"
              aria-label={t("managed.organize")}
              type="button"
              disabled={!input.trim() || !uid}
              onClick={() => void organizeText()}
              size="lg"
            >
              <Icons.generate />
              {t("managed.organize")}
              {!admin && (
                <CreditBadge
                  label={t("managed.expectedPoints", { points: textCost })}
                  value={t("managed.expectedShort", { points: textCost })}
                />
              )}
            </Button>
            <PhotoInputButton
              model={chosenModel}
              tier={tier}
              showCost={!admin}
              disabled={!uid}
              label={t("managed.photo")}
              onFiles={selectPhotos}
            />
            {review && (
              <Button
                onClick={() => onPhase("review")}
                type="button"
                variant="ghost"
              >
                {t("ai.viewResults")}
              </Button>
            )}
          </>
        )}
      </StepActions>
    </div>
  );
}

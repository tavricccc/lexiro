"use client";
import { useEffect, useRef, useState } from "react";
import { LIMITS, buildWordGenerationSources } from "@lexiro/ai-contract";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Icons } from "@/components/ui/icons";
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

export function InputOrganizer({
  onConfirm,
  onInvalidate,
  disabled,
}: {
  onConfirm: (text: string) => void;
  onInvalidate: () => void;
  disabled: boolean;
}) {
  const [input, setInput] = useState("");
  const [review, setReview] = useState<string | null>(null);
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
    onInvalidate();
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
    const sources = buildWordGenerationSources(review || "");
    if (
      !sources.length ||
      sources.some((source) => source.raw.length > LIMITS.source)
    ) {
      setError(t("managed.inputLimit"));
      return;
    }
    onConfirm(review!);
  };
  return (
    <div className="space-y-4">
      <Field
        label={t("setEditor.rawWords")}
        hint={t("managed.organizeTextCost")}
      >
        <Textarea
          value={input}
          maxLength={LIMITS.input}
          disabled={disabled || busy}
          placeholder={t("setEditor.rawWordsPlaceholder")}
          onChange={(event) => {
            setInput(event.target.value);
            setReview(null);
            onInvalidate();
          }}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          disabled={disabled || busy || !input.trim() || !uid}
          onClick={() => void organize()}
        >
          <Icons.generate />
          {t("managed.organize")}
        </Button>
        <Button
          asChild
          type="button"
          variant="secondary"
          disabled={disabled || busy || !uid}
        >
          <label>
            <Icons.import />
            {t("managed.photo")}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={disabled || busy || !uid}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void organize(file);
              }}
            />
          </label>
        </Button>
        <span className="text-xs text-muted-foreground">
          {t("managed.organizeImageCost")}
        </span>
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
      {review !== null && (
        <div className="space-y-3 rounded-xl border p-4">
          <Field
            label={t("managed.reviewLines")}
            hint={t("managed.reviewHint")}
          >
            <Textarea
              value={review}
              maxLength={LIMITS.input}
              disabled={disabled || busy}
              onChange={(event) => {
                setReview(event.target.value);
                onInvalidate();
              }}
              className="min-h-40"
            />
          </Field>
          <Button
            type="button"
            disabled={disabled || busy || !review.trim()}
            onClick={confirm}
          >
            {t("managed.confirmList")}
          </Button>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { LIMITS } from "@lexiro/ai-contract";

import { CreditBadge } from "@/components/ai/credit-badge";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { StepActions } from "@/components/ui/step-actions";
import { TaskProgress } from "@/components/ui/task-progress";
import { t } from "@/lib/i18n";

export interface PhotoProgressState {
  phase: "preparing" | "organizing";
  completed: number;
  total: number;
  currentBatch: number;
  prepared: number;
  batchSize: number;
  characters: number;
  startedAt: number;
}

export function PhotoInputButton({
  disabled,
  label,
  onFiles,
  showCost = true,
}: {
  disabled: boolean;
  label: string;
  onFiles: (files: File[]) => void;
  showCost?: boolean;
}) {
  return (
    <Button asChild type="button" variant="secondary" disabled={disabled}>
      <label>
        <Icons.import />
        {label}
        {showCost && (
          <CreditBadge
            label={t("managed.photoPoints")}
            value={t("managed.photoPointsShort")}
          />
        )}
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

export function PhotoSelection({
  error,
  files,
  onCancel,
  onConfirm,
  onRemove,
  onReplace,
  processed,
}: {
  error: string;
  files: File[];
  onCancel: () => void;
  onConfirm: () => void;
  onRemove: (index: number) => void;
  onReplace: (files: File[]) => void;
  processed: number;
}) {
  const remaining = files.length - processed;
  const batches = Math.ceil(remaining / LIMITS.images);
  const [previews, setPreviews] = useState<{ file: File; url: string }[]>([]);
  useEffect(() => {
    if (typeof URL.createObjectURL !== "function") return;
    const next = files
      .slice(processed)
      .map((file) => ({ file, url: URL.createObjectURL(file) }));
    setPreviews(next);
    return () => next.forEach(({ url }) => URL.revokeObjectURL(url));
  }, [files, processed]);
  return (
    <div className="space-y-5">
      <section className="rule-card py-4">
        <h2 className="type-subsection">{t("managed.photoConfirmTitle")}</h2>
        <p className="mt-1 type-hint">
          {t("managed.photoConfirmSummary", { count: remaining, batches })}
        </p>
        <p className="mt-1 type-hint">{t("managed.photoPoints")}</p>
        {processed > 0 && (
          <p className="mt-2 type-hint">
            {t("managed.photoCompletedKept", { count: processed })}
          </p>
        )}
        <ul
          className="mt-4 max-h-52 divide-y divide-[var(--rule)] overflow-y-auto"
          aria-label={t("managed.photoSelectedList")}
        >
          {files.slice(processed).map((file, offset) => (
            <li
              className="flex min-h-11 items-center justify-between gap-3 py-2"
              key={`${processed + offset}:${file.name}`}
            >
              <div className="flex min-w-0 items-center gap-3">
                {previews[offset]?.file === file && (
                  <img
                    alt=""
                    className="size-14 shrink-0 rounded-md bg-[var(--surface-inset)] object-cover"
                    loading="lazy"
                    src={previews[offset].url}
                  />
                )}
                <span className="min-w-0 break-all text-sm">{file.name}</span>
              </div>
              <Button
                aria-label={t("managed.photoRemove", { name: file.name })}
                onClick={() => onRemove(processed + offset)}
                size="icon-xs"
                type="button"
                variant="ghost"
              >
                <Icons.delete />
              </Button>
            </li>
          ))}
        </ul>
      </section>
      <p className="type-hint">
        {t(
          processed
            ? "managed.photoRemainingNotSaved"
            : "managed.photoSelectionNotSaved",
        )}
      </p>
      <StepActions width="wide">
        {error && (
          <p
            className="whitespace-pre-wrap break-words text-sm text-destructive"
            role="alert"
          >
            {error}
          </p>
        )}
        <Button className="w-full" onClick={onConfirm} size="lg" type="button">
          <Icons.generate />
          {t(processed ? "managed.photoResume" : "managed.photoConfirm", {
            count: remaining,
          })}
        </Button>
        <PhotoInputButton
          disabled={false}
          label={t("managed.photoReplace")}
          onFiles={onReplace}
          showCost={false}
        />
        <Button onClick={onCancel} type="button" variant="ghost">
          {t("managed.photoCancel")}
        </Button>
      </StepActions>
    </div>
  );
}

export function PhotoRunProgress({
  progress,
  seconds,
}: {
  progress: PhotoProgressState;
  seconds: number;
}) {
  return (
    <TaskProgress
      activeFraction={
        progress.phase === "preparing"
          ? (0.75 * progress.prepared) / progress.batchSize
          : 0.9
      }
      elapsed={t("ai.elapsed", { seconds })}
      label={t("managed.photoProgressLabel")}
      max={progress.total}
      summary={t("managed.photoBatchesCompleted", {
        completed: progress.completed,
        total: progress.total,
      })}
      title={t(
        progress.phase === "preparing"
          ? "managed.photoPreparing"
          : "managed.photoOrganizing",
      )}
      value={progress.completed}
    >
      <span>
        {progress.phase === "preparing"
          ? t("managed.photoPreparingDetail", {
              current: progress.currentBatch,
              prepared: progress.prepared,
              total: progress.batchSize,
            })
          : t("managed.photoStreamingDetail", {
              current: progress.currentBatch,
              count: progress.characters.toLocaleString(),
            })}
      </span>
    </TaskProgress>
  );
}

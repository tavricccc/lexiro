"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { ActionFeedbackIcon } from "@/components/ui/action-feedback-icon";
import { Icons } from "@/components/ui/icons";
import { ListSkeleton } from "@/components/ui/workspace-skeleton";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";

export function LoadingState({ rows = 4 }: { rows?: number }) {
  return <ListSkeleton rows={rows} />;
}

/**
 * An empty screen is an invitation to act, so it shows the shape of the thing
 * that belongs there — a dictionary entry — rather than a shrug icon. The
 * `filtered` variant is for a search or filter that matched nothing, where the
 * fix is to change the query, not to create anything.
 */
export function EmptyState({
  action,
  description,
  headword,
  pos,
  secondaryAction,
  title,
  variant = "empty",
}: {
  action?: ReactNode;
  description: string;
  headword?: string;
  pos?: string;
  secondaryAction?: ReactNode;
  title: string;
  variant?: "empty" | "filtered";
}) {
  if (variant === "filtered") {
    return (
      <div className="rule-card py-12 text-center">
        <p className="font-medium">{title}</p>
        <p className="mx-auto mt-1.5 max-w-[42ch] type-lead">{description}</p>
      </div>
    );
  }

  return (
    <div className="rule-card py-14 text-center sm:py-16">
      {headword && (
        <div
          aria-hidden
          className="mx-auto mb-9 w-fit max-w-full select-none border-y border-dashed px-6 py-5 text-left opacity-55"
        >
          <div className="flex items-baseline gap-3">
            <span className="entry-headword">{headword}</span>
            {pos && <span className="entry-pos">{pos}</span>}
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
        </div>
      )}
      <h2 className="type-section">{title}</h2>
      {!headword && (
        <p className="mx-auto mt-2 max-w-[46ch] type-lead">{description}</p>
      )}
      {(action || secondaryAction) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
}: {
  error: string;
  onRetry?: () => void;
}) {
  return (
    <div className="t-shake rule-card py-12 text-center" data-error="true">
      <div className="mx-auto grid size-10 place-items-center rounded-full bg-destructive/10 text-destructive">
        <Icons.error className="size-5" />
      </div>
      <h2 className="mt-4 type-section">{t("common.loadFailed")}</h2>
      <p className="mx-auto mt-2 max-w-[52ch] type-lead">{error}</p>
      {onRetry && (
        <Button variant="outline" className="mt-6" onClick={onRetry}>
          <Icons.retry />
          {t("common.reload")}
        </Button>
      )}
    </div>
  );
}

export function BusyLabel({
  busy,
  busyLabel,
  label,
  success = false,
}: {
  busy: boolean;
  busyLabel: string;
  label: string;
  success?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      {busy && (
        <ActionFeedbackIcon
          className="bg-transparent [&>svg]:size-4"
          size="sm"
          state={success ? "success" : "loading"}
        />
      )}
      <span
        className={cn(busy && "t-shimmer")}
        data-text={busy ? busyLabel : undefined}
      >
        {busy ? busyLabel : label}
      </span>
    </span>
  );
}

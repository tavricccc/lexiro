"use client";

import type { ReactNode } from "react";

import { BackControl } from "@/components/ui/back-control";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StepActions } from "@/components/ui/step-actions";
import { t } from "@/lib/i18n";

/**
 * One step of a guided flow.
 *
 * The counter is the whole point: it promises that the screen is asking for one
 * thing and that there is a known number of things left. Anything the step does
 * not need is not rendered — a step with three questions on it is not a step.
 */
export function StepFrame({
  back,
  children,
  current,
  footer,
  onBack,
  recap,
  status,
  title,
  total,
  width = "narrow",
}: {
  /** Leaving the flow entirely, when there is no earlier step to go back to. */
  back?: ReactNode;
  children: ReactNode;
  current: number;
  /** The single action that advances or completes the flow. */
  footer?: ReactNode;
  onBack?: () => void;
  /** What earlier steps settled, so the choice stays visible without editing. */
  recap?: ReactNode;
  status?: ReactNode;
  title: string;
  total: number;
  /** A step that reviews produced content needs more room than one that asks. */
  width?: "narrow" | "wide";
}) {
  return (
    <div
      className={width === "wide" ? "mx-auto max-w-3xl" : "mx-auto max-w-xl"}
    >
      <PageHeader
        back={onBack ? <BackControl onClick={onBack} /> : back}
        actions={status}
        footer={
          total > 1 ? (
            <div className="flex items-center gap-3">
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {t("common.stepOf", { current, total })}
              </span>
              <div
                aria-label={t("common.flowProgress")}
                aria-valuemin={1}
                aria-valuemax={total}
                aria-valuenow={current}
                className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-border"
                role="progressbar"
              >
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(current / total) * 100}%` }}
                />
              </div>
            </div>
          ) : undefined
        }
        title={title}
      />

      {recap && <div className="mb-5">{recap}</div>}

      {children}

      {footer && <StepActions width={width}>{footer}</StepActions>}
    </div>
  );
}

/** The settled answers of earlier steps, as one quiet line each. */
export function StepRecap({
  editLabel,
  items,
  onEdit,
}: {
  editLabel?: string;
  items: string[];
  onEdit?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-[var(--radius-card)] bg-[var(--surface-inset)] px-4 py-3 text-sm">
      {items.map((item) => (
        <span className="text-muted-foreground" key={item}>
          {item}
        </span>
      ))}
      {onEdit && (
        <Button
          className="ml-auto"
          onClick={onEdit}
          size="xs"
          type="button"
          variant="ghost"
        >
          {editLabel ?? t("practice.changeMode")}
        </Button>
      )}
    </div>
  );
}

"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
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
  description,
  footer,
  onBack,
  recap,
  title,
  total,
  width = "narrow",
}: {
  /** Leaving the flow entirely, when there is no earlier step to go back to. */
  back?: ReactNode;
  children: ReactNode;
  current: number;
  description?: string;
  /** The single action that advances or completes the flow. */
  footer?: ReactNode;
  onBack?: () => void;
  /** What earlier steps settled, so the choice stays visible without editing. */
  recap?: ReactNode;
  title: string;
  total: number;
  /** A step that reviews produced content needs more room than one that asks. */
  width?: "narrow" | "wide";
}) {
  return (
    <div className={width === "wide" ? "mx-auto max-w-3xl" : "mx-auto max-w-xl"}>
      <PageHeader
        back={
          onBack ? (
            <Button onClick={onBack} size="sm" type="button" variant="ghost">
              <Icons.back />
              {t("common.back")}
            </Button>
          ) : (
            back
          )
        }
        className="mb-5 md:mb-6"
        description={description}
        title={title}
      />

      <p className="mb-5 text-xs tabular-nums text-muted-foreground">
        {t("common.stepOf", { current, total })}
      </p>

      {recap && <div className="mb-5">{recap}</div>}

      {children}

      {footer && <div className="mt-7 rule-t pt-6">{footer}</div>}
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

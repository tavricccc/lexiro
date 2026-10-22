import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { t } from "@/lib/i18n";

function LoadingFrame({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      aria-busy="true"
      aria-label={t("common.loading")}
      className={`w-full ${className}`}
    >
      {children}
    </div>
  );
}

function HeaderSkeleton({
  action = false,
  back = false,
  className = "",
  flow = false,
  root = false,
}: {
  action?: boolean;
  back?: boolean;
  className?: string;
  flow?: boolean;
  root?: boolean;
}) {
  return (
    <header
      className={`page-header mb-[var(--page-content-gap)] space-y-[var(--page-header-gap)] ${className}`}
    >
      {back && (
        <div className="flex h-9 items-center">
          <Skeleton className="h-4 w-14 rounded" />
        </div>
      )}
      <div className="flex min-h-9 items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-7 w-32 rounded-md" />
        </div>
        {(action || root) && (
          <div className="flex items-center gap-2">
            {action && <Skeleton className="size-9 shrink-0 rounded-lg" />}
            {root && (
              <Skeleton className="size-9 shrink-0 rounded-lg md:hidden" />
            )}
          </div>
        )}
      </div>
      {flow && (
        <div className="flex items-center gap-3">
          <Skeleton className="h-3 w-14 rounded" />
          <Skeleton className="h-1 flex-1 rounded-full" />
        </div>
      )}
    </header>
  );
}

function RowSkeleton({
  kind = "library",
}: {
  kind?: "library" | "question" | "recent";
}) {
  return (
    <div className="flex min-h-[3.25rem] items-start gap-3.5 py-[var(--row-padding-block)]">
      <Skeleton className="mt-0.5 size-5 shrink-0 rounded-md" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton
          className={`h-4 rounded-md ${kind === "question" ? "w-[78%]" : "w-[48%]"}`}
        />
        {kind === "library" ? (
          <>
            <Skeleton className="h-1.5 w-32 rounded-full" />
            <Skeleton className="h-3 w-[38%] rounded-md" />
          </>
        ) : (
          <Skeleton className="h-3 w-[28%] rounded-md" />
        )}
      </div>
      <Skeleton className="mt-1 size-4 shrink-0 rounded-md" />
    </div>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <LoadingFrame className="rule-card rule-list">
      {Array.from({ length: rows }, (_, index) => (
        <RowSkeleton key={index} />
      ))}
    </LoadingFrame>
  );
}

export function LibraryListSkeleton() {
  return (
    <LoadingFrame className="rule-card rule-list">
      {Array.from({ length: 5 }, (_, index) => (
        <RowSkeleton key={index} />
      ))}
    </LoadingFrame>
  );
}

export function QuestionListSkeleton() {
  return (
    <LoadingFrame className="rule-card rule-list">
      {Array.from({ length: 4 }, (_, index) => (
        <RowSkeleton kind="question" key={index} />
      ))}
    </LoadingFrame>
  );
}

export function PracticePageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-xl">
      <HeaderSkeleton back flow />
      <div className="rule-card rule-list">
        <RowSkeleton kind="question" />
        <RowSkeleton kind="question" />
      </div>
    </div>
  );
}

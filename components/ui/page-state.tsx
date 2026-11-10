import Link from "@/components/ui/app-link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { ListSkeleton } from "@/components/ui/workspace-skeleton";
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
export function EmptyState({ action, title, variant = "empty" }: { action?: ReactNode; description?: string; headword?: string; pos?: string; secondaryAction?: ReactNode; title: string; variant?: "empty" | "filtered" }) {
  return <section className="empty" role="status"><img src="/illustrations/open-doodles-reading.svg" alt="" /><h2 className="t-section">{title}</h2>{action ?? <Link className="btn btn-primary" href={variant === "filtered" ? "/app/library" : "/app/sets/new"}>{t(variant === "filtered" ? "redesign.library" : "library.newSet")}</Link>}</section>;
}

export function ErrorState({
  error,
  onRetry,
}: {
  error: string;
  onRetry?: () => void;
}) {
  return (
    <div
      className="t-shake rule-card py-12 text-center"
      data-error="true"
      role="alert"
    >
      <div className="mx-auto grid size-10 place-items-center rounded-full bg-destructive/10 text-destructive">
        <Icons.error className="size-5" />
      </div>
      <h2 className="mt-4 type-section">{t("common.loadFailed")}</h2>
      <p className="mx-auto mt-2 max-w-[52ch] type-lead">{error}</p>
      {onRetry && (
        <Button variant="outline" className="mt-6" onClick={onRetry}>
          <Icons.refresh />
          {t("common.reload")}
        </Button>
      )}
    </div>
  );
}

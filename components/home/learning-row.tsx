"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { PRACTICE_SESSION_STORAGE_KEY } from "@/constants";
import { t } from "@/lib/i18n";
import { useLibraryStore } from "@/stores/library-store";
import { parsePracticeSession } from "@/src/lib/practice-session";
import type { PracticeSessionSnapshot } from "@/types";

export function LearningRows() {
  const state = useLibraryStore((store) => store.state);
  const status = useLibraryStore((store) => store.status);
  const [session, setSession] = useState<PracticeSessionSnapshot | null>(null);

  useEffect(() => {
    setSession(
      parsePracticeSession(localStorage.getItem(PRACTICE_SESSION_STORAGE_KEY)),
    );
  }, []);

  const recentSets = useMemo(
    () =>
      state.sets
        .toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 4)
        .map((entry) => ({
          count: (state.memberships[entry.id] ?? []).reduce(
            (sum, item) => sum + item.senseIds.length,
            0,
          ),
          id: entry.id,
          name: entry.setName,
        })),
    [state.memberships, state.sets],
  );

  const done = session ? session.index : 0;
  const total = session?.itemIds.length ?? 0;
  // A library with nothing in it is already explained by the canvas above, so
  // this row stays away rather than repeating the invitation.
  const showRecent = status !== "ready" || recentSets.length > 0;

  if (!session && !showRecent) return null;

  return (
    <div className="section-gap grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
      {session && (
        <section>
          <h2 className="font-lexical text-xl font-medium">
            {t("home.resumeTitle")}
          </h2>
          <div className="mt-3 flex items-center gap-4 border-y py-4">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">
                {state.sets.find((entry) => entry.id === session.setId)
                  ?.setName ?? t("practice.allSets")}
              </p>
              <p className="mt-1.5 flex items-center gap-2.5 text-sm text-muted-foreground">
                <span className="tabular-nums">
                  {t("practice.progress", { current: done, total })}
                </span>
                <span
                  aria-hidden
                  className="h-1 w-20 overflow-hidden rounded-full bg-[var(--surface-inset)]"
                >
                  <span
                    className="block h-full rounded-full bg-primary"
                    style={{
                      width: `${total ? Math.min(100, (done / total) * 100) : 0}%`,
                    }}
                  />
                </span>
              </p>
            </div>
            <Button asChild size="sm" variant="secondary">
              <Link href="/practice">
                <Icons.start />
                {t("home.resumeAction")}
              </Link>
            </Button>
          </div>
        </section>
      )}

      {showRecent && (
        <section>
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-lexical text-xl font-medium">
              {t("home.recentTitle")}
            </h2>
            {recentSets.length > 0 && (
              <Link
                className="text-sm font-medium text-primary hover:underline"
                href="/library"
              >
                {t("home.viewAll")}
              </Link>
            )}
          </div>
          <ul className="mt-3 divide-y border-y">
            {recentSets.map((set) => (
              <li key={set.id}>
                <Link
                  className="group flex items-center gap-3 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  href={`/sets/${set.id}`}
                >
                  <Icons.library
                    aria-hidden
                    className="size-5 shrink-0 text-muted-foreground"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium group-hover:text-primary">
                      {set.name}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {t("library.senseCount", { count: set.count })}
                    </span>
                  </span>
                  <Icons.open
                    aria-hidden
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

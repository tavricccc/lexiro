"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Icons } from "@/components/ui/icons";
import { ListNavRow, ListSection } from "@/components/ui/list";
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
  const total = session?.entryIds.length ?? 0;
  // A library with nothing in it is already explained by the canvas above, so
  // this row stays away rather than repeating the invitation.
  const showRecent = status !== "ready" || recentSets.length > 0;

  if (!session && !showRecent) return null;

  return (
    <div className="section-gap grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
      {session && (
        // Resuming is going somewhere, so it is a row that leads there rather
        // than a card with a button parked in it. The progress it was carrying
        // is what a row's second line is for.
        <ListSection header={t("home.resumeTitle")}>
          <ListNavRow
            detail={
              <span className="flex items-center gap-2.5">
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
              </span>
            }
            href="/app/practice"
            icon={Icons.start}
            label={
              state.sets.find((entry) => entry.id === session.setId)?.setName ??
              t("practice.allSets")
            }
          />
        </ListSection>
      )}

      {showRecent && (
        // The grouped list, not a hand-made copy of it. The copy answered a tap
        // by recolouring its own label, where every other row in the product
        // tints the row, so the same gesture felt like a different control.
        <ListSection
          header={t("home.recentTitle")}
          headerAction={
            recentSets.length > 0 && (
              <Link
                className="text-sm font-medium text-primary hover:underline"
                href="/app/library"
              >
                {t("home.viewAll")}
              </Link>
            )
          }
        >
          {recentSets.map((set) => (
            <ListNavRow
              detail={t("library.senseCount", { count: set.count })}
              href={`/app/sets/${set.id}`}
              icon={Icons.library}
              key={set.id}
              label={set.name}
            />
          ))}
        </ListSection>
      )}
    </div>
  );
}

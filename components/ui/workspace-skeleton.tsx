"use client";

import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";

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
          {root && <Skeleton className="size-8 rounded-lg md:hidden" />}
          <Skeleton className="h-7 w-32 rounded-md" />
        </div>
        {(action || root) && (
          <div className="flex items-center gap-2">
            {action && <Skeleton className="size-9 shrink-0 rounded-lg" />}
            {root && <Skeleton className="size-9 shrink-0 rounded-lg md:hidden" />}
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

function TabsSkeleton() {
  return (
    <div className="mb-5 flex w-fit gap-1 rounded-full bg-muted p-1">
      <Skeleton className="h-11 w-24 rounded-full" />
      <Skeleton className="h-11 w-28 rounded-full" />
    </div>
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

function LibraryPageSkeleton() {
  return (
    <div>
      <HeaderSkeleton action root />
      <div className="rule-b pb-4">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-8 w-36 rounded-md" />
          <Skeleton className="size-9 rounded-lg" />
        </div>
      </div>
      <Skeleton className="mt-4 h-11 w-full rounded-lg" />
      <div className="mt-5">
        <LibraryListSkeleton />
      </div>
    </div>
  );
}

function QuestionsPageSkeleton() {
  return (
    <div>
      <HeaderSkeleton action back />
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_9rem]">
        <Skeleton className="h-11 rounded-lg" />
        <Skeleton className="h-11 rounded-lg" />
        <Skeleton className="h-11 rounded-lg" />
      </div>
      <div className="mt-5">
        <QuestionListSkeleton />
      </div>
    </div>
  );
}

function HomePageSkeleton() {
  return (
    <div>
      <HeaderSkeleton className="md:hidden" root />
      <section className="relative overflow-hidden rounded-[var(--radius-stage)] bg-surface-canvas px-6 py-8 sm:px-9 sm:py-10">
        <div className="max-w-2xl space-y-3">
          <Skeleton className="h-10 w-[min(27rem,90%)] rounded-lg" />
          <div className="mt-7 flex gap-10">
            <div className="space-y-2">
              <Skeleton className="h-3 w-16 rounded" />
              <Skeleton className="h-10 w-12 rounded" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3 w-20 rounded" />
              <Skeleton className="h-10 w-12 rounded" />
            </div>
          </div>
          <Skeleton className="mt-5 h-4 w-[min(32rem,90%)] rounded-md" />
        </div>
      </section>
      <div className="mt-5">
        <Skeleton className="mb-2 h-4 w-24 rounded" />
        <ListSkeleton rows={3} />
      </div>
      <div className="section-gap grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
        <section>
          <Skeleton className="h-6 w-28 rounded-md" />
          <div className="rule-card mt-3 flex items-center gap-4 py-4">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-2/5 rounded" />
              <Skeleton className="h-3 w-1/3 rounded" />
            </div>
            <Skeleton className="h-9 w-20 rounded-lg" />
          </div>
        </section>
        <section>
          <Skeleton className="h-6 w-28 rounded-md" />
          <div className="mt-3 rule-card rule-list">
            {Array.from({ length: 3 }, (_, index) => (
              <RowSkeleton kind="recent" key={index} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export function ProgressPageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <HeaderSkeleton root />
      <section className="rule-card space-y-2 py-6">
        <Skeleton className="h-14 w-20 rounded-lg" />
        <Skeleton className="h-4 w-40 rounded" />
      </section>
      <div className="section-gap">
        <ListSkeleton rows={7} />
      </div>
    </div>
  );
}

function MePageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <HeaderSkeleton root />
      <div className="rule-card flex min-h-20 items-center gap-4 py-4">
        <Skeleton className="size-12 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-32 rounded" />
          <Skeleton className="h-3 w-44 rounded" />
        </div>
      </div>
      <div className="section-gap">
        <ListSkeleton rows={4} />
      </div>
    </div>
  );
}

function SyncPageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-4xl">
      <HeaderSkeleton back />
      <div className="mb-[var(--section-gap)] flex items-center gap-4 rounded-xl bg-muted p-5 sm:p-7">
        <Skeleton className="size-12 shrink-0 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-36 rounded" />
          <Skeleton className="h-4 w-48 rounded" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <section className="rule-t py-7 first:pt-0 sm:py-9">
        <div className="grid gap-5 sm:grid-cols-[13.5rem_minmax(0,1fr)] sm:gap-8">
          <div className="space-y-3">
            <Skeleton className="h-5 w-28 rounded" />
            <Skeleton className="h-4 w-full max-w-xs rounded" />
          </div>
          <Skeleton className="h-10 w-32 rounded-lg" />
        </div>
      </section>
    </div>
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

function SetViewPageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <HeaderSkeleton action back />
      <Skeleton className="mb-6 h-4 w-64 max-w-full rounded" />
      <TabsSkeleton />
      <Skeleton className="mb-2 h-4 w-20 rounded" />
      <ListSkeleton rows={3} />
      <div className="section-gap">
        <ListSkeleton rows={4} />
      </div>
    </div>
  );
}

function SetEditorPageSkeleton({ newSet }: { newSet: boolean }) {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <HeaderSkeleton back action={!newSet} />
      {newSet ? (
        <div className="rule-card rule-list">
          <RowSkeleton kind="question" />
          <RowSkeleton kind="question" />
        </div>
      ) : (
        <>
          <div className="mb-7 grid grid-cols-2 gap-x-10 gap-y-4 sm:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <div className="space-y-2" key={index}>
                <Skeleton className="h-3 w-14 rounded" />
                <Skeleton className="h-8 w-12 rounded" />
              </div>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_14rem]">
            <Skeleton className="h-11 rounded-lg" />
            <Skeleton className="h-11 rounded-lg" />
          </div>
          <Skeleton className="section-gap h-6 w-20 rounded-md" />
          <div className="mt-4 rule-card rule-list">
            {Array.from({ length: 3 }, (_, index) => (
              <div className="space-y-4 py-6" key={index}>
                <div className="grid gap-4 sm:grid-cols-[minmax(0,22rem)_9rem]">
                  <Skeleton className="h-11 rounded-lg" />
                  <Skeleton className="h-11 rounded-lg" />
                </div>
                <Skeleton className="h-11 rounded-lg" />
                <Skeleton className="h-24 rounded-lg" />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function QuestionGeneratorPageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-xl">
      <HeaderSkeleton back flow />
      <div className="rule-card rule-list">
        <RowSkeleton kind="question" />
        <RowSkeleton kind="question" />
        <RowSkeleton kind="question" />
      </div>
    </div>
  );
}

function QuestionEditorPageSkeleton({ reading }: { reading: boolean }) {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <HeaderSkeleton back />
      {reading ? (
        <>
          <div className="grid gap-4">
            <Skeleton className="h-11 rounded-lg" />
            <Skeleton className="h-52 rounded-lg" />
            <Skeleton className="h-11 w-56 rounded-lg" />
          </div>
          <div className="section-gap rule-card rule-list">
            {Array.from({ length: 3 }, (_, index) => (
              <div className="space-y-4 py-6" key={index}>
                <Skeleton className="h-6 w-36 rounded" />
                <Skeleton className="h-11 rounded-lg" />
                <Skeleton className="h-11 rounded-lg" />
                <div className="space-y-2">
                  {Array.from({ length: 4 }, (_, option) => (
                    <Skeleton className="h-10 rounded-lg" key={option} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="rule-card grid gap-4 py-6 sm:grid-cols-2">
            <Skeleton className="h-11 rounded-lg" />
            <Skeleton className="h-11 rounded-lg" />
            <Skeleton className="h-11 rounded-lg sm:col-span-2" />
          </div>
          <div className="mt-7 grid gap-5">
            <Skeleton className="h-11 rounded-lg" />
            <div className="space-y-2">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton className="h-10 rounded-lg" key={index} />
              ))}
            </div>
            <Skeleton className="h-20 rounded-lg" />
          </div>
        </>
      )}
    </div>
  );
}

function SubpageSkeleton({
  flow = false,
  wide = false,
}: {
  flow?: boolean;
  wide?: boolean;
}) {
  return (
    <div className={`mx-auto w-full ${wide ? "max-w-3xl" : "max-w-2xl"}`}>
      <HeaderSkeleton back flow={flow} />
      <ListSkeleton rows={3} />
    </div>
  );
}

function WorkspaceSkeletonContent({ location }: { location: string }) {
  const [pathname] = location.split("?");

  if (pathname === "/app") return <HomePageSkeleton />;
  if (pathname === "/app/library") return <LibraryPageSkeleton />;
  if (pathname === "/app/questions") return <QuestionsPageSkeleton />;
  if (pathname === "/app/progress") return <ProgressPageSkeleton />;
  if (pathname === "/app/practice") return <PracticePageSkeleton />;
  if (pathname === "/app/me") return <MePageSkeleton />;
  if (pathname === "/app/sync") return <SyncPageSkeleton />;
  if (pathname === "/app/sets/new") return <SetEditorPageSkeleton newSet />;
  if (pathname === "/app/sets/new/organize")
    return <SubpageSkeleton flow wide />;
  if (pathname.startsWith("/app/me/") || pathname.startsWith("/app/progress/"))
    return <SubpageSkeleton />;
  if (
    /^\/app\/sets\/[^/]+\/(add|supplement|settings|words\/[^/]+\/edit)$/.test(
      pathname,
    )
  )
    return <SubpageSkeleton />;
  if (pathname.endsWith("/edit") && pathname.startsWith("/app/sets/"))
    return <SetEditorPageSkeleton newSet={false} />;
  if (pathname.startsWith("/app/sets/")) return <SetViewPageSkeleton />;
  if (pathname === "/app/questions/generate")
    return <QuestionGeneratorPageSkeleton />;
  if (pathname.startsWith("/app/questions/reading/"))
    return <QuestionEditorPageSkeleton reading />;
  if (pathname.startsWith("/app/questions/"))
    return <QuestionEditorPageSkeleton reading={false} />;
  return <ListSkeleton />;
}

export function WorkspaceSkeleton() {
  const location = useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener("popstate", onStoreChange);
      return () => window.removeEventListener("popstate", onStoreChange);
    },
    () => `${window.location.pathname}${window.location.search}`,
    () => "/app",
  );
  return <WorkspaceSkeletonContent location={location} />;
}

export function RouteWorkspaceSkeleton() {
  return <WorkspaceSkeletonContent location={usePathname()} />;
}

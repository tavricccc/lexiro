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
}: {
  action?: boolean;
  back?: boolean;
}) {
  if (!action && !back) return null;

  return (
    <header className="mb-7 md:mb-9">
      <div className="flex items-center justify-between gap-3">
        {back ? <Skeleton className="h-8 w-16 rounded-lg" /> : <span />}
        {action && <Skeleton className="h-10 w-32 shrink-0 rounded-lg" />}
      </div>
    </header>
  );
}

function TabsSkeleton() {
  return (
    <div className="mb-5 flex gap-1 rounded-xl bg-muted p-1">
      <Skeleton className="h-9 w-24 rounded-lg" />
      <Skeleton className="h-9 w-28 rounded-lg" />
    </div>
  );
}

function RowSkeleton({
  kind = "library",
}: {
  kind?: "library" | "question" | "recent";
}) {
  return (
    <div className="flex items-start gap-3.5 py-4">
      <Skeleton className="mt-0.5 size-5 shrink-0 rounded-md" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className={`h-4 rounded-md ${kind === "question" ? "w-[78%]" : "w-[48%]"}`} />
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
    <div className="mx-auto w-full max-w-5xl">
      <HeaderSkeleton action />
      <TabsSkeleton />
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
    <div className="mx-auto w-full max-w-5xl">
      <HeaderSkeleton action />
      <TabsSkeleton />
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
    <div className="mx-auto w-full max-w-5xl">
      <section className="relative overflow-hidden rounded-[var(--radius-stage)] bg-surface-canvas px-6 py-8 sm:px-9 sm:py-10">
        <div className="max-w-2xl space-y-3">
          <Skeleton className="h-10 w-[min(27rem,90%)] rounded-lg" />
          <div className="mt-7 flex gap-10">
            <div className="space-y-2"><Skeleton className="h-3 w-16 rounded" /><Skeleton className="h-10 w-12 rounded" /></div>
            <div className="space-y-2"><Skeleton className="h-3 w-20 rounded" /><Skeleton className="h-10 w-12 rounded" /></div>
          </div>
          <Skeleton className="mt-5 h-4 w-[min(32rem,90%)] rounded-md" />
          <div className="mt-6 flex gap-2.5">
            <Skeleton className="h-11 w-32 rounded-lg" />
            <Skeleton className="h-11 w-36 rounded-lg" />
          </div>
        </div>
      </section>
      <div className="section-gap grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
        <section>
          <Skeleton className="h-6 w-28 rounded-md" />
          <div className="rule-card mt-3 flex items-center gap-4 py-4">
            <div className="min-w-0 flex-1 space-y-2"><Skeleton className="h-4 w-2/5 rounded" /><Skeleton className="h-3 w-1/3 rounded" /></div>
            <Skeleton className="h-9 w-20 rounded-lg" />
          </div>
        </section>
        <section>
          <Skeleton className="h-6 w-28 rounded-md" />
          <div className="mt-3 rule-card rule-list">
            {Array.from({ length: 3 }, (_, index) => <RowSkeleton kind="recent" key={index} />)}
          </div>
        </section>
      </div>
    </div>
  );
}

export function ProgressPageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <HeaderSkeleton action />
      <section className="rule-card grid gap-x-14 gap-y-8 py-8 sm:grid-cols-[auto_auto]">
        <div className="space-y-2"><Skeleton className="h-14 w-20 rounded-lg" /><Skeleton className="h-4 w-28 rounded" /></div>
        <div className="grid grid-cols-2 gap-x-10 gap-y-6 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => <div className="space-y-2" key={index}><Skeleton className="h-8 w-14 rounded" /><Skeleton className="h-3 w-16 rounded" /></div>)}
        </div>
      </section>
      <ProgressSectionSkeleton chart={false} rows={1} />
      <ProgressSectionSkeleton chart rows={0} />
      <ProgressSectionSkeleton chart={false} rows={5} />
    </div>
  );
}

function ProgressSectionSkeleton({
  chart,
  rows,
}: {
  chart: boolean;
  rows: number;
}) {
  return (
    <section className="section-gap">
      <Skeleton className="h-6 w-32 rounded-md" />
      <div className="rule-card mt-4 py-5">
        {chart ? (
          <div className="flex h-40 items-end gap-2">
            {Array.from({ length: 14 }, (_, index) => <Skeleton className="w-full max-w-9 rounded-t" key={index} style={{ height: `${22 + ((index * 17) % 62)}%` }} />)}
          </div>
        ) : rows === 1 ? (
          <Skeleton className="h-2 w-full rounded-full" />
        ) : (
          <div className="space-y-5">
            {Array.from({ length: rows }, (_, index) => <div className="grid grid-cols-[12rem_minmax(0,1fr)_5rem] items-center gap-4" key={index}><Skeleton className="h-4 w-28 rounded" /><Skeleton className="h-1.5 w-full rounded-full" /><Skeleton className="h-4 w-12 rounded" /></div>)}
          </div>
        )}
        {chart && <Skeleton className="mt-4 h-3 w-40 rounded" />}
      </div>
    </section>
  );
}

function MePageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-4xl">
      {Array.from({ length: 3 }, (_, index) => (
        <section className="rule-t py-7 first:pt-0 sm:py-9" key={index}>
          <div className="grid gap-5 sm:grid-cols-[13.5rem_minmax(0,1fr)] sm:gap-8"><div className="space-y-3"><Skeleton className="h-5 w-28 rounded" /><Skeleton className="h-4 w-full max-w-xs rounded" /></div><div className="space-y-4"><Skeleton className="h-11 w-full rounded-lg" /><Skeleton className="h-11 w-full rounded-lg" /></div></div>
        </section>
      ))}
    </div>
  );
}

function SyncPageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="mb-8 flex items-center gap-4 rounded-xl bg-muted p-5 sm:p-7"><Skeleton className="size-12 shrink-0 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-6 w-36 rounded" /><Skeleton className="h-4 w-48 rounded" /></div><Skeleton className="h-6 w-20 rounded-full" /></div>
      <section className="rule-t py-7 first:pt-0 sm:py-9">
        <div className="grid gap-5 sm:grid-cols-[13.5rem_minmax(0,1fr)] sm:gap-8"><div className="space-y-3"><Skeleton className="h-5 w-28 rounded" /><Skeleton className="h-4 w-full max-w-xs rounded" /></div><Skeleton className="h-10 w-32 rounded-lg" /></div>
      </section>
    </div>
  );
}

export function PracticePageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-xl">
      <HeaderSkeleton back />
      <Skeleton className="mb-5 h-3 w-20 rounded" />
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
      <div className="mb-7 grid grid-cols-2 gap-x-10 gap-y-4 sm:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div className="space-y-2" key={index}><Skeleton className="h-3 w-14 rounded" /><Skeleton className="h-8 w-12 rounded" /></div>)}</div>
      <TabsSkeleton />
      <div className="rule-card rule-list">{Array.from({ length: 4 }, (_, index) => <RowSkeleton key={index} />)}</div>
    </div>
  );
}

function SetEditorPageSkeleton({ newSet }: { newSet: boolean }) {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <HeaderSkeleton back action={!newSet} />
      {newSet ? (
        <div className="rule-card rule-list"><RowSkeleton kind="question" /><RowSkeleton kind="question" /></div>
      ) : (
        <>
          <div className="mb-7 grid grid-cols-2 gap-x-10 gap-y-4 sm:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div className="space-y-2" key={index}><Skeleton className="h-3 w-14 rounded" /><Skeleton className="h-8 w-12 rounded" /></div>)}</div>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_14rem]"><Skeleton className="h-11 rounded-lg" /><Skeleton className="h-11 rounded-lg" /></div>
          <Skeleton className="section-gap h-6 w-20 rounded-md" />
          <div className="mt-4 rule-card rule-list">{Array.from({ length: 3 }, (_, index) => <div className="space-y-4 py-6" key={index}><div className="grid gap-4 sm:grid-cols-[minmax(0,22rem)_9rem]"><Skeleton className="h-11 rounded-lg" /><Skeleton className="h-11 rounded-lg" /></div><Skeleton className="h-11 rounded-lg" /><Skeleton className="h-24 rounded-lg" /></div>)}</div>
        </>
      )}
    </div>
  );
}

function QuestionGeneratorPageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-xl">
      <HeaderSkeleton back />
      <Skeleton className="mb-5 h-3 w-20 rounded" />
      <div className="rule-card rule-list"><RowSkeleton kind="question" /><RowSkeleton kind="question" /><RowSkeleton kind="question" /></div>
    </div>
  );
}

function QuestionEditorPageSkeleton({ reading }: { reading: boolean }) {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <HeaderSkeleton back />
      {reading ? (
        <>
          <div className="grid gap-4"><Skeleton className="h-11 rounded-lg" /><Skeleton className="h-52 rounded-lg" /><Skeleton className="h-11 w-56 rounded-lg" /></div>
          <div className="section-gap rule-card rule-list">{Array.from({ length: 3 }, (_, index) => <div className="space-y-4 py-6" key={index}><Skeleton className="h-6 w-36 rounded" /><Skeleton className="h-11 rounded-lg" /><Skeleton className="h-11 rounded-lg" /><div className="space-y-2">{Array.from({ length: 4 }, (_, option) => <Skeleton className="h-10 rounded-lg" key={option} />)}</div></div>)}</div>
        </>
      ) : (
        <>
          <div className="rule-card grid gap-4 py-6 sm:grid-cols-2"><Skeleton className="h-11 rounded-lg" /><Skeleton className="h-11 rounded-lg" /><Skeleton className="h-11 rounded-lg sm:col-span-2" /></div>
          <div className="mt-7 grid gap-5"><Skeleton className="h-11 rounded-lg" /><div className="space-y-2">{Array.from({ length: 4 }, (_, index) => <Skeleton className="h-10 rounded-lg" key={index} />)}</div><Skeleton className="h-20 rounded-lg" /></div>
        </>
      )}
    </div>
  );
}

function WorkspaceSkeletonContent({ location }: { location: string }) {
  const [pathname, search = ""] = location.split("?");
  const searchParams = new URLSearchParams(search);

  if (pathname === "/") return <HomePageSkeleton />;
  if (pathname === "/library")
    return searchParams.get("tab") === "questions" ? (
      <QuestionsPageSkeleton />
    ) : (
      <LibraryPageSkeleton />
    );
  if (pathname === "/progress") return <ProgressPageSkeleton />;
  if (pathname === "/practice") return <PracticePageSkeleton />;
  if (pathname === "/me") return <MePageSkeleton />;
  if (pathname === "/sync") return <SyncPageSkeleton />;
  if (pathname === "/sets/new") return <SetEditorPageSkeleton newSet />;
  if (pathname.endsWith("/edit") && pathname.startsWith("/sets/"))
    return <SetEditorPageSkeleton newSet={false} />;
  if (pathname.startsWith("/sets/")) return <SetViewPageSkeleton />;
  if (pathname === "/questions/generate") return <QuestionGeneratorPageSkeleton />;
  if (pathname.startsWith("/questions/reading/")) return <QuestionEditorPageSkeleton reading />;
  if (pathname.startsWith("/questions/")) return <QuestionEditorPageSkeleton reading={false} />;
  return <ListSkeleton />;
}

export function WorkspaceSkeleton() {
  const location = useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener("popstate", onStoreChange);
      return () => window.removeEventListener("popstate", onStoreChange);
    },
    () => `${window.location.pathname}${window.location.search}`,
    () => "/",
  );
  return <WorkspaceSkeletonContent location={location} />;
}

export function RouteWorkspaceSkeleton() {
  return <WorkspaceSkeletonContent location={usePathname()} />;
}

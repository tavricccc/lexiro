import type * as React from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { ErrorState, LoadingList, PageHeader, cn } from "design-kit";
import { errorMessage } from "@/data/api";
import { useDocumentTitle } from "./title";

/** A screen: its header, then its sections with even spacing. */
export function Page({ back, title, description, actions, children, className, documentTitle }: {
  back?: { href: string; label: string };
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  documentTitle?: string;
}) {
  useDocumentTitle(documentTitle ?? (typeof title === "string" ? title : undefined));
  return (
    <div className={cn("content-in grid gap-6", className)}>
      <PageHeader actions={actions} back={back} description={description} title={title} />
      {children}
    </div>
  );
}

/** Renders `children` with the data, or the loading or error state in its place. */
export function Loaded<T>({ query, children, label = "載入中" }: {
  query: UseQueryResult<T>;
  children: (data: T) => React.ReactNode;
  label?: string;
}) {
  if (query.data !== undefined) return <>{children(query.data)}</>;
  if (query.isError)
    return <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} retryLabel="再試一次" title="讀取失敗" />;
  return <LoadingList label={label} rows={3} />;
}

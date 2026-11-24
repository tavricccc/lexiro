import { useState } from "react";
import type * as React from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { ErrorState, LoadingList, PageHeader, cn } from "design-kit";
import { errorMessage } from "@/data/api";
import { useScreen } from "./screen";
import { useDocumentTitle } from "./title";

/** A screen: its header, then its sections with even spacing. */
export function Page({ back, title, description, actions, children, className, documentTitle }: {
  /** Where the back control leads when nothing lies beneath this screen. */
  back?: { href: string; label: string };
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  documentTitle?: string;
}) {
  const { presentation } = useScreen();
  const sheet = presentation === "sheet" || presentation === "modal";
  useDocumentTitle(documentTitle ?? (typeof title === "string" ? title : undefined));
  return (
    <div className={cn("grid grid-cols-[minmax(0,1fr)] gap-6", className)}>
      <PageHeader actions={actions} back={back} className={sheet ? "contents" : undefined} description={description} sheet={sheet} title={title} />
      {children}
    </div>
  );
}

/** Renders `children` with the data, or the loading or error state in its place. */
export function Loaded<T>({ query, children, label = "載入中", className }: {
  query: UseQueryResult<T>;
  children: (data: T) => React.ReactNode;
  label?: string;
  /** How the content is laid out; evenly spaced sections by default. */
  className?: string;
}) {
  // Content that takes a placeholder's place fades in; content that was there is simply there.
  const [waited, setWaited] = useState(query.data === undefined);
  if (query.data === undefined && !waited) setWaited(true);
  if (query.data !== undefined)
    return <div className={cn(className ?? "grid grid-cols-[minmax(0,1fr)] gap-6", waited && "content-in")}>{children(query.data)}</div>;
  if (query.isError)
    return <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} retryLabel="再試一次" title="讀取失敗" />;
  return <LoadingList label={label} rows={3} />;
}

/** The screen's main action, kept where a thumb reaches it while the page scrolls beneath. */
export function BottomBar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("sticky bottom-[calc(var(--screen-foot,0px)+1rem)] z-30", className)} data-bottom-bar="">{children}</div>
  );
}

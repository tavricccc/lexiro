import type { ReactNode } from "react";

import { BackControl } from "@/components/ui/back-control";
import { PageHeader } from "@/components/ui/page-header";
import { t } from "@/lib/i18n";

export function MeSubpage({
  children,
  parentHref = "/app/me",
  parentLabel = t("me.title"),
  title,
}: {
  children: ReactNode;
  parentHref?: string;
  parentLabel?: string;
  title: string;
}) {
  return (
    <div className="mx-auto max-w-2xl pb-4">
      <PageHeader
        back={<BackControl href={parentHref} label={parentLabel} />}
        title={title}
      />
      {children}
    </div>
  );
}

import type { ReactNode } from "react";

import { BackControl } from "@/components/ui/back-control";
import { PageHeader } from "@/components/ui/page-header";
import { t } from "@/lib/i18n";

export function ProgressSubpage({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <div className="mx-auto max-w-2xl pb-4">
      <PageHeader
        back={<BackControl href="/app/progress" label={t("progress.title")} />}
        title={title}
      />
      {children}
    </div>
  );
}

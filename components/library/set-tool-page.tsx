import type { ReactNode } from "react";

import { BackControl } from "@/components/ui/back-control";
import { PageHeader } from "@/components/ui/page-header";
import { t } from "@/lib/i18n";

export function SetToolPage({
  children,
  setId,
  title,
  returnHref,
}: {
  children: ReactNode;
  setId: string;
  title: string;
  returnHref?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl pb-4">
      <PageHeader
        back={
          <BackControl
            href={returnHref ?? `/app/sets/${setId}`}
            label={t("setEditor.backToSet")}
          />
        }
        title={title}
      />
      {children}
    </div>
  );
}

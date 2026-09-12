import type { ReactNode } from "react";

import { BackControl } from "@/components/ui/back-control";
import { PageHeader } from "@/components/ui/page-header";
import { t } from "@/lib/i18n";

export function SetToolPage({
  children,
  setId,
  title,
}: {
  children: ReactNode;
  setId: string;
  title: string;
}) {
  return (
    <div className="mx-auto max-w-2xl pb-4">
      <PageHeader
        back={
          <BackControl
            href={`/sets/${setId}`}
            label={t("setEditor.backToSet")}
          />
        }
        title={title}
      />
      {children}
    </div>
  );
}

"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { StepActions } from "@/components/ui/step-actions";
import { t } from "@/lib/i18n";

export function ResumeChoice({
  back,
  description,
  header = true,
  invalid = false,
  onRestart,
  onResume,
}: {
  back?: ReactNode;
  description: string;
  header?: boolean;
  invalid?: boolean;
  onRestart: () => void;
  onResume: () => void;
}) {
  return (
    <div className="mx-auto max-w-xl">
      {header && <PageHeader back={back} title={t(invalid ? "draft.invalidTitle" : "draft.title")} />}
      <p className="type-lead">{description}</p>
      <StepActions>
        {!invalid && (
          <Button className="w-full" onClick={onResume} size="lg">
            <Icons.next />
            {t("draft.resume")}
          </Button>
        )}
        <Button className="w-full" onClick={onRestart} size="lg" variant={invalid ? "default" : "outline"}>
          <Icons.create />
          {t("draft.restart")}
        </Button>
      </StepActions>
    </div>
  );
}

"use client";

import { useId, type ReactNode } from "react";
import { LiquidTabs } from "@/components/ui/liquid-tabs";
import { t } from "@/lib/i18n";

export type QuestionWorkspacePane = "passage" | "questions";

export function QuestionWorkspace({
  passage,
  questions,
  pane,
  onPaneChange,
  passageLabel = t("questions.passageSection"),
  questionsLabel = t("questions.questionsPane"),
}: {
  passage: ReactNode;
  questions: ReactNode;
  pane: QuestionWorkspacePane;
  onPaneChange: (pane: QuestionWorkspacePane) => void;
  passageLabel?: string;
  questionsLabel?: string;
}) {
  const id = useId();
  const panelIds = { passage: `${id}-passage`, questions: `${id}-questions` };
  return (
    <div className="min-w-0">
      <LiquidTabs
        ariaLabel={t("questions.workspaceTabs")}
        className="mb-5 lg:hidden [&_.t-tabs]:flex [&_.t-tabs]:w-full [&_.t-tab]:flex-1"
        options={[
          { value: "passage", label: passageLabel },
          { value: "questions", label: questionsLabel },
        ]}
        value={pane}
        panelIds={panelIds}
        onValueChange={(value) => onPaneChange(value as QuestionWorkspacePane)}
      />
      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(20rem,1fr)] lg:gap-8">
        <section
          id={panelIds.passage}
          role="tabpanel"
          aria-label={passageLabel}
          className={pane === "passage" ? "min-w-0" : "hidden min-w-0 lg:block"}
        >
          {passage}
        </section>
        <section
          id={panelIds.questions}
          role="tabpanel"
          aria-label={questionsLabel}
          className={
            pane === "questions" ? "min-w-0" : "hidden min-w-0 lg:block"
          }
        >
          {questions}
        </section>
      </div>
    </div>
  );
}

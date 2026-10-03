"use client";

import { useId, useState, type Ref } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { Icons } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";
import { difficultyLabel, difficultyOptions } from "@/lib/question-options";

/** Keep phone space for the current question; metadata remains one tap away. */
export function QuestionMetadata({
  title,
  difficulty,
  titleError,
  titleRef,
  onTitleChange,
  onDifficultyChange,
}: {
  title: string;
  difficulty: 1 | 2 | 3;
  titleError?: string | false;
  titleRef: Ref<HTMLInputElement>;
  onTitleChange: (value: string) => void;
  onDifficultyChange: (value: 1 | 2 | 3) => void;
}) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const expanded = open || Boolean(titleError);
  return (
    <div className="mb-5">
      <Button
        type="button"
        variant="ghost"
        className="mb-2 min-h-11 w-full justify-between sm:hidden"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
      >
        <span>
          {t("questions.metadata")} · {difficultyLabel(difficulty)}
        </span>
        <Icons.next
          className={cn("size-4 transition-transform", expanded && "rotate-90")}
        />
      </Button>
      <div
        id={panelId}
        className={cn(
          "grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]",
          !expanded && "hidden sm:grid",
        )}
      >
        <Field label={t("questions.readingTitle")} error={titleError}>
          <Input
            ref={titleRef}
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            className="text-base"
          />
        </Field>
        <SelectField
          label={t("practice.difficulty")}
          value={String(difficulty)}
          options={difficultyOptions()}
          onValueChange={(value) =>
            onDifficultyChange(Number(value) as 1 | 2 | 3)
          }
        />
      </div>
    </div>
  );
}

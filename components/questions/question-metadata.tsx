import { type Ref } from "react";

import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";


import { t } from "@/lib/i18n";
import { difficultyOptions } from "@/lib/question-options";

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
  return <div className="entry metadata-fields"><div className="grid gap-4">
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
  ;
}

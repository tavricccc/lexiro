"use client";

import { AnswerOptions } from "@/components/questions/answer-options";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Icons } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { SelectField, type SelectOption } from "@/components/ui/select-field";
import { t } from "@/lib/i18n";

export interface ReadingChildDraft {
  answerIndex: number;
  id?: string;
  options: string[];
  prompt: string;
  source: string;
}

export interface ReadingChildErrors {
  options?: string;
  prompt?: string;
  source?: string;
}

export function ReadingChildEditor({
  child,
  errors,
  index,
  onRemove,
  onUpdate,
  senses,
  submitted,
}: {
  child: ReadingChildDraft;
  errors: ReadingChildErrors;
  index: number;
  onRemove?: () => void;
  onUpdate: (patch: Partial<ReadingChildDraft>) => void;
  senses: SelectOption[];
  submitted: boolean;
}) {
  const label = t("questions.childPrompt", { index: index + 1 });
  return (
    <section className="py-6" data-reading-child>
      <div className="flex items-center justify-between gap-3">
        <h2 className="type-subsection">{label}</h2>
        {onRemove && (
          <Button
            aria-label={t("questions.removeChild", { index: index + 1 })}
            onClick={onRemove}
            size="icon"
            type="button"
            variant="ghost"
          >
            <Icons.delete />
          </Button>
        )}
      </div>

      <div className="mt-4 grid gap-4">
        <SelectField
          description={t("questions.linkedSense")}
          onValueChange={(source) => onUpdate({ source })}
          options={senses}
          placeholder={t("questions.selectSense")}
          value={child.source}
        />
        {submitted && errors.source && (
          <p className="-mt-2 text-xs text-destructive" role="alert">
            {errors.source}
          </p>
        )}
        <Field error={submitted && errors.prompt} label={t("questions.prompt")}>
          <Input
            name={`reading-prompt-${index}`}
            onChange={(event) => onUpdate({ prompt: event.target.value })}
            placeholder={t("questions.prompt")}
            value={child.prompt}
          />
        </Field>
        <AnswerOptions
          answerIndex={child.answerIndex}
          error={submitted && errors.options}
          labelPrefix={`${label} · `}
          name={`reading-answer-${index}`}
          onAnswerChange={(answerIndex) => onUpdate({ answerIndex })}
          onOptionChange={(optionIndex, value) =>
            onUpdate({
              options: child.options.map((option, at) =>
                at === optionIndex ? value : option,
              ),
            })
          }
          options={child.options}
        />
      </div>
    </section>
  );
}

"use client";

import { AnswerOptions } from "@/components/questions/answer-options";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Icons } from "@/components/ui/icons";
import { Textarea } from "@/components/ui/textarea";
import { SelectField, type SelectOption } from "@/components/ui/select-field";
import { t } from "@/lib/i18n";
import { DistractorReasonsEditor } from "./distractor-reasons-editor";
import { remapOptionReasons } from "./option-reasons";

export interface ReadingChildDraft {
  answerIndex: number;
  id?: string;
  options: string[];
  prompt: string;
  source: string;
  blank?: number;
  explanation?: string;
  whyWrong?: Record<string, string>;
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
  sharedBank,
  blankFormat = false,
}: {
  child: ReadingChildDraft;
  errors: ReadingChildErrors;
  index: number;
  onRemove?: () => void;
  onUpdate: (patch: Partial<ReadingChildDraft>) => void;
  senses: SelectOption[];
  submitted: boolean;
  sharedBank?: string[];
  blankFormat?: boolean;
}) {
  const label = t("questions.childPrompt", { index: index + 1 });
  return (
    <section className="py-2" data-reading-child>
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
          ariaLabel={t("questions.linkedSense")}
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
        {!blankFormat && (
          <Field
            error={submitted && errors.prompt}
            label={t("questions.prompt")}
          >
            <Textarea
              name={`reading-prompt-${index}`}
              onChange={(event) => onUpdate({ prompt: event.target.value })}
              placeholder={t("questions.prompt")}
              value={child.prompt}
              className="min-h-24 text-base leading-7"
            />
          </Field>
        )}
        {sharedBank ? (
          <SelectField
            label={t("questions.blankAnswer", { index: child.blank! })}
            description={t("questions.blankAnswerHint")}
            value={String(child.answerIndex)}
            onValueChange={(value) =>
              onUpdate({
                answerIndex: Number(value),
                whyWrong: remapOptionReasons(
                  sharedBank,
                  sharedBank,
                  child.whyWrong,
                  Number(value),
                ),
              })
            }
            options={sharedBank.map((option, at) => ({
              value: String(at),
              label: `${String.fromCharCode(65 + at)} · ${option}`,
            }))}
          />
        ) : (
          <AnswerOptions
            answerIndex={child.answerIndex}
            error={submitted && errors.options}
            labelPrefix={`${label} · `}
            name={`reading-answer-${index}`}
            onAnswerChange={(answerIndex) =>
              onUpdate({
                answerIndex,
                whyWrong: remapOptionReasons(
                  child.options,
                  child.options,
                  child.whyWrong,
                  answerIndex,
                ),
              })
            }
            onOptionChange={(optionIndex, value) => {
              const options = child.options.map((option, at) =>
                at === optionIndex ? value : option,
              );
              onUpdate({
                options,
                whyWrong: remapOptionReasons(
                  child.options,
                  options,
                  child.whyWrong,
                  child.answerIndex,
                ),
              });
            }}
            options={child.options}
          />
        )}
        <Field label={t("questions.explanation")}>
          <Textarea
            value={child.explanation ?? ""}
            onChange={(event) => onUpdate({ explanation: event.target.value })}
            className="min-h-24 text-base leading-7"
          />
        </Field>
        <DistractorReasonsEditor
          options={sharedBank ?? child.options}
          answerIndex={child.answerIndex}
          reasons={child.whyWrong}
          onChange={(whyWrong) => onUpdate({ whyWrong })}
        />
      </div>
    </section>
  );
}

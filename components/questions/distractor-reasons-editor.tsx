"use client";

import { useState } from "react";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { t } from "@/lib/i18n";
import { remapOptionReasons } from "./option-reasons";

export function DistractorReasonsEditor({
  options,
  answerIndex,
  reasons,
  onChange,
}: {
  options: string[];
  answerIndex: number;
  reasons?: Record<string, string>;
  onChange: (reasons: Record<string, string>) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className="min-w-0 rule-t pt-3"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium leading-6 md:min-h-9">
        {t("questions.distractorReasons")}
      </summary>
      {open && (
        <div className="mt-3 grid min-w-0 gap-4">
          {options.map((option, index) =>
            index === answerIndex || !option.trim() ? null : (
              <Field
                key={index}
                label={t("questions.reasonForOption", {
                  letter: String.fromCharCode(65 + index),
                  option: option.trim(),
                })}
              >
                <Textarea
                  value={reasons?.[option.trim()] ?? ""}
                  onChange={(event) =>
                    onChange({
                      ...remapOptionReasons(
                        options,
                        options,
                        reasons,
                        answerIndex,
                      ),
                      [option.trim()]: event.target.value,
                    })
                  }
                  placeholder={t("questions.reasonPlaceholder")}
                  className="min-h-20 text-base leading-7"
                />
              </Field>
            ),
          )}
        </div>
      )}
    </details>
  );
}

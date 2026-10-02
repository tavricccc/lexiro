"use client";

import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { t } from "@/lib/i18n";

export function QuestionPager({
  index,
  total,
  onChange,
  disabled = false,
  blanks = false,
}: {
  index: number;
  total: number;
  onChange: (index: number) => void;
  disabled?: boolean;
  blanks?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium tabular-nums">
          {t(blanks ? "questions.blankPosition" : "questions.reviewPosition", {
            current: index + 1,
            total,
          })}
        </p>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("questions.previousItem")}
            disabled={disabled || index === 0}
            onClick={() => onChange(index - 1)}
          >
            <Icons.back />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("questions.nextItem")}
            disabled={disabled || index === total - 1}
            onClick={() => onChange(index + 1)}
          >
            <Icons.next />
          </Button>
        </div>
      </div>
      {total > 1 && (
        <div
          className="flex gap-1.5 overflow-x-auto pb-1"
          role="group"
          aria-label={t("questions.chooseItem")}
        >
          {Array.from({ length: total }, (_, at) => (
            <Button
              key={at}
              type="button"
              size="sm"
              variant={at === index ? "secondary" : "ghost"}
              className="min-h-11 min-w-11 shrink-0 tabular-nums md:min-h-9 md:min-w-9"
              aria-pressed={at === index}
              aria-label={t(
                blanks ? "questions.blankLabel" : "questions.childPrompt",
                { index: at + 1 },
              )}
              disabled={disabled}
              onClick={() => onChange(at)}
            >
              {at + 1}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

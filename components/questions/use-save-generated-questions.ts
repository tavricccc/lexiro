"use client";
import { useRef, useState } from "react";
import { toast } from "sonner";
import type { LibraryQuestion } from "@/types";
import { useLibraryStore } from "@/stores/library-store";
import { t } from "@/lib/i18n";

export function useSaveGeneratedQuestions(onDone: () => void) {
  const saveQuestion = useLibraryStore((s) => s.saveQuestion);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const save = async (questions: LibraryQuestion[]) => {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    let stored = 0;
    try {
      for (const question of questions)
        if ((await saveQuestion(question)) === "saved") stored++;
      onDone();
      const duplicates = questions.length - stored;
      toast.success(
        duplicates > 0
          ? t("questions.savedCountWithDuplicates", {
              count: stored,
              duplicates,
            })
          : t("questions.savedCount", { count: stored }),
      );
    } catch (reason) {
      toast.error(
        reason instanceof Error ? reason.message : t("ai.invalidReply"),
      );
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };
  return { saving, save };
}

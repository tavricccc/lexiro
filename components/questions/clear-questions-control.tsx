import { useState } from "react";
import type { LibraryQuestion } from "@/types";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Icons } from "@/components/ui/icons";
import { t } from "@/lib/i18n";
import { useLibraryStore } from "@/stores/library-store";

function questionCounts(questions: LibraryQuestion[]) {
  return questions.reduce(
    (counts, question) => ({
      questions:
        counts.questions +
        (question.kind === "reading" ? question.questions.length : 1),
      packs: counts.packs + (question.kind === "reading" ? 1 : 0),
    }),
    { questions: 0, packs: 0 },
  );
}

/** The count covers every stored item in this scope, including retired types. */
export function ClearQuestionsControl({
  questions,
  setId,
  setName,
}: {
  questions: LibraryQuestion[];
  setId?: string;
  setName?: string;
}) {
  const { status, clearQuestions } = useLibraryStore();
  const [open, setOpen] = useState(false);
  const count = questionCounts(questions);
  const title = t(setId ? "questions.clearSet" : "questions.clearAll");
  const description = [
    t(setId ? "questions.clearSetConfirm" : "questions.clearAllConfirm", {
      name: setName ?? "",
      count: count.questions,
    }),
    count.packs ? t("questions.clearPacks", { count: count.packs }) : "",
    t("questions.clearPreserves"),
  ]
    .filter(Boolean)
    .join("\n\n");

  return (
    <div className="mb-4 flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
      <Button
        className="h-11 md:h-9"
        disabled={status !== "ready" || questions.length === 0}
        onClick={() => {
          setOpen(true);
        }}
        size="sm"
        type="button"
        variant="ghost"
      >
        <Icons.delete />
        {title}
      </Button>
      <ConfirmDialog
        confirmLabel={t("questions.confirmClear")}
        description={description}
        onConfirm={async () => {
          await clearQuestions(setId);
        }}
        onOpenChange={setOpen}
        open={open}
        title={title}
      />
    </div>
  );
}

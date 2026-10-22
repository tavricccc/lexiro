import {
  QuestionList,
  type QuestionFilters,
} from "@/components/questions/question-list";
import { BackControl } from "@/components/ui/back-control";
import { PageHeader } from "@/components/ui/page-header";
import { t } from "@/lib/i18n";
import { useLibraryStore } from "@/stores/library-store";
import { ClearQuestionsControl } from "./clear-questions-control";

/** The question bank is a destination in its own right, not a Library tab. */
export function QuestionBankPage({
  initialFilters,
}: {
  initialFilters?: QuestionFilters;
}) {
  const questions = useLibraryStore((store) => store.state.questions);
  return (
    <div>
      <PageHeader
        back={<BackControl href="/app/library" label={t("library.title")} />}
        title={t("questions.title")}
      />
      <ClearQuestionsControl questions={questions} />
      <QuestionList initialFilters={initialFilters} />
    </div>
  );
}

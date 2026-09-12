import type { LibraryQuestion } from "@/types";
import { QuestionPreview } from "./question-preview";

export function GeneratedQuestionResults({
  items,
}: {
  items: LibraryQuestion[];
}) {
  return (
    <ol className="mt-4 rule-card rule-list">
      {items.map((question) => (
        <li className="py-5" key={question.id}>
          <QuestionPreview question={question} />
        </li>
      ))}
    </ol>
  );
}

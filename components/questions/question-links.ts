import { withReturnTo } from "@/lib/browse-routes";

export function questionEditHref(
  question: { id: string; kind: string },
  returnTo?: string,
) {
  const href =
    question.kind === "reading"
      ? `/app/questions/reading/${question.id}/edit`
      : `/app/questions/${question.id}/edit`;
  return returnTo ? withReturnTo(href, returnTo) : href;
}

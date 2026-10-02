import { QuestionEditor } from "@/components/questions/question-editor";
import { readBrowseReturn } from "@/lib/browse-routes";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ questionId: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { questionId } = await params;
  const { returnTo } = await searchParams;
  return (
    <QuestionEditor
      questionId={questionId}
      returnHref={readBrowseReturn(returnTo)}
    />
  );
}

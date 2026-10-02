import { ReadingEditor } from "@/components/questions/reading-editor";
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
    <ReadingEditor
      readingId={questionId}
      returnHref={readBrowseReturn(returnTo)}
    />
  );
}

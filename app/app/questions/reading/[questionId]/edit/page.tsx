import { ReadingEditor } from "@/components/questions/reading-editor";
export default async function Page({ params }: { params: Promise<{ questionId: string }> }) { const { questionId } = await params; return <ReadingEditor readingId={questionId} />; }

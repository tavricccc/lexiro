import { QuestionEditor } from "@/components/questions/question-editor";
export default async function Page({ params }: { params: Promise<{ questionId: string }> }) { const { questionId } = await params; return <QuestionEditor questionId={questionId} />; }

import { QuestionGenerator } from "@/components/questions/question-generator";
export default async function Page({ searchParams }: { searchParams: Promise<{ set?: string }> }) { const query = await searchParams; return <QuestionGenerator setId={query.set} />; }

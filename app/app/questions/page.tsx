import { QuestionBankPage } from "@/components/questions/question-bank-page";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; kind?: string; difficulty?: string }>;
}) {
  const filters = await searchParams;
  return (
    <QuestionBankPage
      key={`${filters.q ?? ""}:${filters.kind ?? ""}:${filters.difficulty ?? ""}`}
      initialFilters={filters}
    />
  );
}

import { PracticePage } from "@/components/practice/practice-page";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; set?: string; start?: string }>;
}) {
  const query = await searchParams;
  const preset = query.mode === "questions" || query.mode === "review";
  return (
    <PracticePage
      initialAutoStart={query.start === "1"}
      initialMode={query.mode === "questions" ? "questions" : "review"}
      initialModePreset={preset}
      initialSet={query.set ?? ""}
    />
  );
}

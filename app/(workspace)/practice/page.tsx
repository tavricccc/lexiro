import { PracticePage } from "@/components/practice/practice-page";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ set?: string; track?: string }>;
}) {
  const query = await searchParams;
  const track =
    query.track === "fsrs" || query.track === "questions"
      ? query.track
      : undefined;
  return <PracticePage initialSet={query.set ?? ""} initialTrack={track} />;
}

import { AiSetOrganizer } from "@/components/library/ai-set-organizer";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ folderId?: string }>;
}) {
  const { folderId } = await searchParams;
  return <AiSetOrganizer initialFolderId={folderId} />;
}

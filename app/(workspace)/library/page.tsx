import { LibraryPage, type LibraryTab } from "@/components/library/library-page";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ folderId?: string; tab?: string }>;
}) {
  const { folderId, tab } = await searchParams;
  return (
    <LibraryPage
      initialFolderId={folderId}
      initialTab={tab === "questions" ? ("questions" as LibraryTab) : "sets"}
    />
  );
}

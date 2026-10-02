import { LibraryPage } from "@/components/library/library-page";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ folderId?: string; q?: string }>;
}) {
  const { folderId, q } = await searchParams;
  return (
    <LibraryPage
      key={`${folderId ?? ""}:${q ?? ""}`}
      initialFolderId={folderId}
      initialQuery={q}
    />
  );
}

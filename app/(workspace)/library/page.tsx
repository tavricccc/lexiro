import { LibraryPage } from "@/components/library/library-page";

export default async function Page({ searchParams }: { searchParams: Promise<{ folderId?: string }> }) {
  const { folderId } = await searchParams;
  return <LibraryPage initialFolderId={folderId} />;
}

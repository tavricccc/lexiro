import { SetEditor } from "@/components/library/set-editor";

export default async function Page({ searchParams }: { searchParams: Promise<{ folderId?: string }> }) {
  const { folderId } = await searchParams;
  return <SetEditor initialFolderId={folderId} />;
}

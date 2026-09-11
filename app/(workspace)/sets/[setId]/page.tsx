import { SetEditor } from "@/components/library/set-editor";

export default async function Page({ params }: { params: Promise<{ setId: string }> }) {
  const { setId } = await params;
  return <SetEditor setId={setId} />;
}

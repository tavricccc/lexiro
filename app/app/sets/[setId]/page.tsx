import { SetView } from "@/components/library/set-view";

export default async function Page({ params }: { params: Promise<{ setId: string }> }) {
  const { setId } = await params;
  return <SetView setId={setId} />;
}

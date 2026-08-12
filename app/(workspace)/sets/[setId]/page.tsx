import { SetDetail } from "@/components/library/set-detail";

export default async function Page({ params }: { params: Promise<{ setId: string }> }) {
  const { setId } = await params;
  return <SetDetail setId={setId} />;
}

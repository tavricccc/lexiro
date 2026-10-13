import { SharedSetPage } from "@/components/library/shared-set-page";

export default async function Page({
  params,
}: {
  params: Promise<{ shareId: string }>;
}) {
  const { shareId } = await params;
  return <SharedSetPage key={shareId} shareId={shareId} />;
}

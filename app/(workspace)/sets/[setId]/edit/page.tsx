import { redirect } from "next/navigation";

export default async function Page({ params }: { params: Promise<{ setId: string }> }) {
  const { setId } = await params;
  redirect(`/sets/${encodeURIComponent(setId)}`);
}

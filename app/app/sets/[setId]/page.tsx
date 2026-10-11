import { SetView } from "@/components/library/set-view";
import { readBrowseReturn } from "@/lib/browse-routes";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ setId: string }>;
  searchParams: Promise<{ returnTo?: string; tab?: string; q?: string }>;
}) {
  const { setId } = await params;
  const { returnTo, tab, q } = await searchParams;
  return (
    <SetView
      key={`${setId}:${tab ?? "words"}:${q ?? ""}`}
      setId={setId}
      returnTo={readBrowseReturn(returnTo)}
      initialTab={tab}
      initialQuery={q}
    />
  );
}

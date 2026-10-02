import { SetToolPage } from "@/components/library/set-tool-page";
import { WordEditPage } from "@/components/library/word-edit-page";
import { t } from "@/lib/i18n";
import { readBrowseReturn } from "@/lib/browse-routes";

export default async function EditWordPage({
  params,
  searchParams,
}: {
  params: Promise<{ setId: string; wordKey: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { setId, wordKey } = await params;
  const { returnTo } = await searchParams;
  const returnHref = readBrowseReturn(returnTo);
  return (
    <SetToolPage
      setId={setId}
      title={t("setDetail.editWord")}
      returnHref={returnHref}
    >
      <WordEditPage setId={setId} wordKey={wordKey} returnHref={returnHref} />
    </SetToolPage>
  );
}

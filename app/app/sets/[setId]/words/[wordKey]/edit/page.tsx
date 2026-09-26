import { SetToolPage } from "@/components/library/set-tool-page";
import { WordEditPage } from "@/components/library/word-edit-page";
import { t } from "@/lib/i18n";

export default async function EditWordPage(
  {
    params,
  }: {
    params: Promise<{ setId: string; wordKey: string }>;
  },
) {
  const { setId, wordKey } = await params;
  return (
    <SetToolPage setId={setId} title={t("setDetail.editWord")}>
      <WordEditPage setId={setId} wordKey={wordKey} />
    </SetToolPage>
  );
}

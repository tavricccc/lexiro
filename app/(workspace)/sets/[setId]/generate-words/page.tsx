import { SetToolPage } from "@/components/library/set-tool-page";
import { SetWordAddition } from "@/components/library/set-word-addition";
import { t } from "@/lib/i18n";

export default async function GenerateWordsPage(
  { params }: { params: Promise<{ setId: string }> },
) {
  const { setId } = await params;
  return (
    <SetToolPage setId={setId} title={t("setEditor.aiAssist")}>
      <SetWordAddition mode="ai" setId={setId} />
    </SetToolPage>
  );
}

import { SetSenseSupplement } from "@/components/library/set-sense-supplement";
import { SetToolPage } from "@/components/library/set-tool-page";
import { t } from "@/lib/i18n";

export default async function SupplementSensesPage(
  { params }: { params: Promise<{ setId: string }> },
) {
  const { setId } = await params;
  return (
    <SetToolPage setId={setId} title={t("supplement.title")}>
      <SetSenseSupplement setId={setId} />
    </SetToolPage>
  );
}

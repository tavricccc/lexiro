import { SetMetadata } from "@/components/library/set-metadata";
import { SetToolPage } from "@/components/library/set-tool-page";
import { t } from "@/lib/i18n";

export default async function SetSettingsPage(
  { params }: { params: Promise<{ setId: string }> },
) {
  const { setId } = await params;
  return (
    <SetToolPage setId={setId} title={t("wordEdit.metadata")}>
      <SetMetadata setId={setId} />
    </SetToolPage>
  );
}

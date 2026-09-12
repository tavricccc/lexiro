import { DataSection } from "@/components/me/data-section";
import { MeSubpage } from "@/components/me/me-subpage";
import { t } from "@/lib/i18n";

export default function DataPage() {
  return (
    <MeSubpage title={t("settings.data")}>
      <DataSection />
    </MeSubpage>
  );
}

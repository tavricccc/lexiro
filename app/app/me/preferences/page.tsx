import { MeSubpage } from "@/components/me/me-subpage";
import { PreferencesSection } from "@/components/me/preferences-section";
import { t } from "@/lib/i18n";

export default function PreferencesPage() {
  return (
    <MeSubpage title={t("me.preferences")}>
      <PreferencesSection />
    </MeSubpage>
  );
}

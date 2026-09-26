import { MeSubpage } from "@/components/me/me-subpage";
import { PlanSection } from "@/components/me/plan-section";
import { t } from "@/lib/i18n";

export default function PlanPage() {
  return (
    <MeSubpage title={t("managed.planTitle")}>
      <PlanSection />
    </MeSubpage>
  );
}

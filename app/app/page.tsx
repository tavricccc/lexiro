import { FocusCanvas } from "@/components/home/focus-canvas";
import { LearningRows } from "@/components/home/learning-row";
import { RootPageHeader } from "@/components/root-page-header";
import { t } from "@/lib/i18n";

export default function HomePage() {
  return (
    <>
      <RootPageHeader title={t("nav.study")} />
      <FocusCanvas />
      <LearningRows />
    </>
  );
}

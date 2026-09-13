import { FocusCanvas } from "@/components/home/focus-canvas";
import { LearningRows } from "@/components/home/learning-row";
import { RootPageHeader } from "@/components/root-page-header";
import { t } from "@/lib/i18n";

export default function HomePage() {
  return (
    <>
      {/* The canvas below opens with a greeting, which is the heading this
          screen wants on a desktop. A phone still needs a title bar, for the
          mark and the sync status the sidebar carries everywhere else. */}
      <RootPageHeader className="md:hidden" title={t("nav.study")} />
      <FocusCanvas />
      <LearningRows />
    </>
  );
}

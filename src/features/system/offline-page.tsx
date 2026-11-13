import { AppLink, Button, EmptyState } from "design-kit";
import { useDocumentTitle } from "@/ui/title";

export default function OfflinePage() {
  useDocumentTitle("離線");
  return (
    <div className="grid min-h-svh place-items-center px-[var(--gutter)]">
      <EmptyState
        action={<Button asChild variant="primary"><AppLink href="/app">回到 Lexiro</AppLink></Button>}
        description="這一頁還沒存到這台裝置。已開過的單字集和練習在離線時仍可使用。"
        title="目前離線"
      />
    </div>
  );
}

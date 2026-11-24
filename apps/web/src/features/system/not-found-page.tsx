import { AppLink, Button, EmptyState } from "design-kit";
import { useDocumentTitle } from "@/ui/title";

export default function NotFoundPage() {
  useDocumentTitle("找不到頁面");
  return (
    <div className="grid min-h-[60svh] place-items-center px-[var(--gutter)]">
      <EmptyState action={<Button asChild variant="primary"><AppLink href="/app">回到今天</AppLink></Button>} description="網址可能打錯了，或這個頁面已經不存在。" title="找不到這個頁面" />
    </div>
  );
}

import { ArrowLeft } from "@phosphor-icons/react";
import { AppLink, Button } from "design-kit";
import { useDocumentTitle } from "@/ui/title";

export default function NotFoundPage() {
  useDocumentTitle("找不到頁面");
  return (
    <div className="grid min-h-[65svh] place-items-center px-[var(--gutter)] py-12">
      <div className="grid w-full max-w-xl gap-6 border-2 border-line-strong bg-surface p-8 md:p-10">
        <span className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-danger">ERROR // NOT FOUND</span>
        <p className="font-latin text-8xl font-black leading-[0.82] tracking-[-0.06em] text-contrast">404</p>
        <div className="grid gap-1 border-t border-line pt-5">
          <h1 className="text-2xl font-extrabold tracking-[-0.02em]">找不到這個頁面</h1>
          <p className="text-sm text-ink-muted">網址可能打錯了，或這個頁面已經不存在。</p>
        </div>
        <div>
          <Button asChild size="lg" variant="primary"><AppLink href="/app"><ArrowLeft weight="bold" />回到今天</AppLink></Button>
        </div>
      </div>
    </div>
  );
}

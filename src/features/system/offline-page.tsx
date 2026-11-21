import { ArrowLeft } from "@phosphor-icons/react";
import { AppLink, Button } from "design-kit";
import { useDocumentTitle } from "@/ui/title";

export default function OfflinePage() {
  useDocumentTitle("離線");
  return (
    <div className="swiss-grid-bg grid min-h-svh place-items-center px-[var(--gutter)] py-12">
      <div className="grid w-full max-w-xl gap-6 border-2 border-line-strong bg-surface p-8 shadow-float md:p-10">
        <span className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-caution">NETWORK // DISCONNECTED</span>
        <p className="font-latin text-6xl font-black uppercase leading-[0.9] tracking-[-0.05em] text-ink md:text-7xl">OFFLINE</p>
        <div className="grid gap-1 border-t border-line pt-5">
          <h1 className="text-2xl font-extrabold tracking-[-0.02em]">目前離線</h1>
          <p className="text-sm leading-relaxed text-ink-muted">這一頁還沒快取到這台裝置。已開啟過的單字集與練習在離線時仍可使用。</p>
        </div>
        <div>
          <Button asChild size="lg" variant="primary"><AppLink href="/app"><ArrowLeft weight="bold" />回到 Lexiro</AppLink></Button>
        </div>
      </div>
    </div>
  );
}

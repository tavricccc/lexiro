import { useEffect, useState } from "react";
import { Outlet } from "react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { ArrowRight, GoogleLogo } from "@phosphor-icons/react";
import { Button, DesignKitProvider, Spinner, Toaster, TooltipProvider, type Navigation } from "design-kit";
import { errorMessage } from "@/data/api";
import { signIn, useAuth } from "@/data/auth";
import { isConfigured } from "@/data/config";
import { queryClient, startPersistence, stopPersistence } from "@/data/queries";
import { Brand } from "@/ui/brand";

let navigation: Navigation | undefined;
export const setKitNavigation = (value: Navigation) => { navigation = value; };

/** Providers every page shares, signed in or not. */
export function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <DesignKitProvider navigation={navigation}>
        <TooltipProvider delayDuration={300}>
          <Outlet />
          <Toaster />
        </TooltipProvider>
      </DesignKitProvider>
    </QueryClientProvider>
  );
}

export function Splash({ label }: { label?: string }) {
  return (
    <div className="swiss-grid-bg grid min-h-svh place-items-center px-6">
      <div className="content-in flex flex-col items-start gap-5 border-2 border-line-strong bg-surface p-8 shadow-float">
        <Brand />
        <span className="flex items-center gap-3 font-mono text-xs font-semibold uppercase tracking-[0.1em] text-ink-muted" role="status">
          <Spinner className="size-4" />
          {label ?? "正在開啟"}
        </span>
      </div>
    </div>
  );
}

function SignInScreen() {
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [error, setError] = useState("");
  return (
    <div className="swiss-grid-bg grid min-h-svh grid-rows-[auto_1fr_auto]">
      {/* Top Swiss registration strip */}
      <header className="flex items-center justify-between border-b-2 border-line-strong bg-surface px-6 py-4 md:px-12">
        <Brand compact />
        <span className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">EDITION 02 // VOCABULARY SYSTEM</span>
      </header>

      {/* Main asymmetric poster grid */}
      <main className="mx-auto grid w-full max-w-[1440px] content-center lg:grid-cols-12">
        <section className="flex flex-col justify-between border-b-2 border-line-strong bg-surface p-8 md:p-14 lg:col-span-7 lg:border-b-0 lg:border-r-2">
          <div className="grid gap-6">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-contrast">01 — PERSONAL LEXICON</p>
            <h1 className="font-latin text-[clamp(3.25rem,9vw,7.5rem)] font-black uppercase leading-[0.88] tracking-[-0.055em] text-ink">
              LEXIRO
            </h1>
            <p className="max-w-lg text-2xl font-bold leading-snug tracking-[-0.02em] text-ink md:text-3xl">
              用自己的單字集練英文
            </p>
          </div>
          <div className="mt-12 grid grid-cols-3 gap-4 border-t border-line pt-6 font-mono text-xs text-ink-muted">
            <div>
              <span className="block font-bold text-ink">01 / SETS</span>
              <span>自建單字與詞義</span>
            </div>
            <div>
              <span className="block font-bold text-ink">02 / DRILL</span>
              <span>多題型即時練習</span>
            </div>
            <div>
              <span className="block font-bold text-ink">03 / SYNC</span>
              <span>跨裝置離線同步</span>
            </div>
          </div>
        </section>

        <section className="flex flex-col justify-between bg-canvas p-8 md:p-14 lg:col-span-5">
          <div className="mb-10 hidden h-28 w-28 bg-contrast lg:grid lg:place-items-end lg:p-3">
            <span className="font-mono text-xs font-bold tracking-[0.12em] text-on-contrast">IKB // 0038FF</span>
          </div>
          <div className="grid gap-6">
            <div className="grid gap-2 border-l-4 border-contrast pl-4">
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.1em] text-ink-muted">ACCESS</p>
              <p className="text-[0.9375rem] leading-relaxed text-ink-muted">
                登入後，單字集、題目和練習紀錄會跟著帳號，在每台裝置都一樣。
              </p>
            </div>
            <Button
              className="h-14 w-full justify-between px-6 text-base"
              disabled={!isConfigured()}
              onClick={() => {
                setStatus("loading");
                setError("");
                signIn().catch((reason) => setError(errorMessage(reason))).finally(() => setStatus("idle"));
              }}
              size="lg"
              status={status}
              variant="primary"
            >
              <span className="flex items-center gap-3">
                <GoogleLogo className="size-5" weight="bold" />
                <span>使用 Google 登入</span>
              </span>
              <ArrowRight className="size-5" weight="bold" />
            </Button>
            {!isConfigured() ? <p className="font-mono text-xs text-ink-faint">這個版本尚未設定登入服務。</p> : null}
            {error ? <p className="message-in border-l-2 border-danger pl-3 text-sm font-medium text-danger" role="alert">{error}</p> : null}
          </div>
        </section>
      </main>

      <footer className="flex items-center justify-between border-t border-line bg-surface px-6 py-3 font-mono text-[0.6875rem] uppercase tracking-[0.1em] text-ink-faint md:px-12">
        <span>LEXIRO ARCHIVE</span>
        <span>OFFLINE-READY PWA</span>
      </footer>
    </div>
  );
}

/** The workspace needs an account; its cached reads are restored before it opens. */
export function RequireAccount() {
  const { ready, account } = useAuth();
  const uid = account?.uid;
  const [restored, setRestored] = useState<string | null>(null);
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    if (uid) void startPersistence(uid).then(() => { if (!cancelled) setRestored(uid); });
    else void stopPersistence().then(() => { if (!cancelled) setRestored(null); });
    return () => { cancelled = true; };
  }, [ready, uid]);
  if (!ready) return <Splash />;
  if (!uid) return <SignInScreen />;
  if (restored !== uid) return <Splash label="正在載入你的單字" />;
  return <Outlet />;
}

import { useEffect, useState } from "react";
import { Outlet } from "react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { GoogleLogo } from "@phosphor-icons/react";
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
        <TooltipProvider delayDuration={400}>
          <Outlet />
          <Toaster />
        </TooltipProvider>
      </DesignKitProvider>
    </QueryClientProvider>
  );
}

export function Splash({ label }: { label?: string }) {
  return (
    <div className="grid min-h-svh place-items-center">
      <div className="content-in flex flex-col items-center gap-5">
        <Brand />
        <span className="flex items-center gap-2.5 text-[0.9375rem] text-ink-muted" role="status">
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
    <div className="grid min-h-svh place-items-center px-6">
      <div className="content-in flex w-full max-w-sm flex-col items-center gap-8 text-center">
        <Brand className="scale-125" />
        <div className="grid gap-2">
          <h1 className="text-2xl font-bold tracking-tight">用自己的單字集練英文</h1>
          <p className="text-[0.9375rem] leading-relaxed text-ink-muted">登入後，單字集、題目和練習紀錄會跟著帳號，在每台裝置都一樣。</p>
        </div>
        <Button
          className="w-full"
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
          <GoogleLogo weight="bold" />
          使用 Google 登入
        </Button>
        {!isConfigured() ? <p className="text-sm text-ink-faint">這個版本尚未設定登入服務。</p> : null}
        {error ? <p className="message-in text-sm text-danger" role="alert">{error}</p> : null}
      </div>
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

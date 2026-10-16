"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";

import { BrandMark } from "@/components/ui/brand";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { ErrorState } from "@/components/ui/page-state";
import { t } from "@/lib/i18n";
import { useCloudStore } from "@/stores/cloud-store";

const LOCAL_ONLY_KEY = "lexiro:local-only";

function readLocalOnly() {
  try {
    return window.localStorage.getItem(LOCAL_ONLY_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Holds the app behind the startup screen until the account and the *local*
 * Library are known, and not one moment longer: sync catches up underneath.
 * A visitor who is signed out is asked to sign in once; choosing to stay on
 * this device is remembered, and every networked feature still asks again.
 */
export function CloudGate({ children }: { children: ReactNode }) {
  const ready = useCloudStore((store) => store.ready);
  const error = useCloudStore((store) => store.error);
  const configured = useCloudStore((store) => store.configured);
  const user = useCloudStore((store) => store.user);
  // Once the store is ready this is client-only, so a remount reads the choice
  // at once instead of showing the startup screen for a frame.
  const [localOnly, setLocalOnly] = useState<boolean | null>(() =>
    useCloudStore.getState().ready ? readLocalOnly() : null,
  );
  useEffect(() => setLocalOnly(readLocalOnly()), []);

  const askSignIn = ready && configured && !user && localOnly === false;
  const waiting = !ready || localOnly === null;
  // A sync failure after the local Library loaded never blocks local work;
  // only a startup that never got that far stops here.
  if (!ready && error)
    return (
      <ErrorState error={error} onRetry={() => window.location.reload()} />
    );

  return (
    <>
      {waiting || askSignIn ? null : children}
      <AnimatePresence initial={false}>
        {waiting || askSignIn ? (
          <motion.div
            key="startup"
            className="startup-screen fixed inset-0 z-50 grid place-items-center overflow-y-auto px-4"
            exit={{ opacity: 0, transition: { duration: 0.24 } }}
          >
            {askSignIn ? (
              <SignInPrompt
                onSkip={() => {
                  try {
                    window.localStorage.setItem(LOCAL_ONLY_KEY, "1");
                  } catch {
                    // Without storage the prompt simply asks again next time.
                  }
                  setLocalOnly(true);
                }}
              />
            ) : (
              <StartupScreen />
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

function Brand() {
  return (
    <div className="flex flex-col items-center gap-4">
      <BrandMark className="size-20 rounded-[1.25rem]" />
      <span className="text-2xl font-semibold tracking-tight">Lexiro</span>
    </div>
  );
}

/** What fills the screen while this device's account and data are read. */
function StartupScreen() {
  const user = useCloudStore((store) => store.user);
  const label = !user ? t("startup.session") : t("startup.library");
  return (
    <div
      className="flex flex-col items-center gap-6 text-center"
      data-startup-screen
    >
      <Brand />
      <p
        className="flex h-6 items-center gap-2.5 text-[0.9375rem] text-muted-foreground"
        role="status"
      >
        <Icons.loading aria-hidden className="size-4 animate-spin" />
        {label}
      </p>
    </div>
  );
}

function SignInPrompt({ onSkip }: { onSkip: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-6 py-10 text-center">
      <Brand />
      <div className="space-y-2">
        <h1 className="type-section">{t("startup.signInTitle")}</h1>
        <p className="text-[0.9375rem] leading-relaxed text-muted-foreground">
          {t("startup.signInBody")}
        </p>
      </div>
      <div className="grid w-full gap-2">
        <Button
          size="lg"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setError("");
            void useCloudStore
              .getState()
              .signIn()
              .catch((reason) =>
                setError(
                  reason instanceof Error ? reason.message : String(reason),
                ),
              )
              .finally(() => setBusy(false));
          }}
        >
          <Icons.signIn />
          {t("settings.signIn")}
        </Button>
        <Button size="lg" variant="ghost" disabled={busy} onClick={onSkip}>
          {t("startup.localOnly")}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

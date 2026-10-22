import { Dialog } from "radix-ui";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { t } from "@/lib/i18n";
import {
  detectInAppBrowser,
  iosNonSafariBrowser,
  isAndroidDevice,
  isIosDevice,
  isStandaloneMode,
  tryRedirectToExternalBrowser,
} from "@/lib/pwa-install";

type Mode =
  "in-app-browser" | "ios-open-safari" | "ios-install" | "native-install";

interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "lexiro:install-prompt-dismissed";

function dismissedThisSession() {
  try {
    return sessionStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

/** Walks a phone visitor from a browser tab to the installed app. */
export function InstallPrompt() {
  const [mode, setMode] = useState<Mode | null>(null);
  const [browser, setBrowser] = useState("");
  const [native, setNative] = useState<InstallEvent | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const { userAgent, platform, maxTouchPoints } = navigator;
    const ios = isIosDevice(userAgent, platform, maxTouchPoints);
    const android = isAndroidDevice(userAgent);
    if (isStandaloneMode() || (!ios && !android)) return;
    const inApp = detectInAppBrowser(userAgent);
    // Sign-in cannot finish inside a messaging app, so leave before asking.
    if (inApp && tryRedirectToExternalBrowser(userAgent)) return;
    if (inApp) {
      setBrowser(inApp);
      setMode("in-app-browser");
      return;
    }
    if (dismissedThisSession()) return;
    const other = iosNonSafariBrowser(userAgent, platform, maxTouchPoints);
    if (other) {
      setBrowser(other === "Google" ? "Google App" : "Chrome");
      setMode("ios-open-safari");
    } else setMode(ios ? "ios-install" : "native-install");
  }, []);

  useEffect(() => {
    const capture = (event: Event) => {
      event.preventDefault();
      setNative(event as InstallEvent);
    };
    const installed = () => setMode(null);
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  if (!mode) return null;

  const close = () => {
    try {
      sessionStorage.setItem(DISMISSED_KEY, "1");
    } catch {}
    setMode(null);
  };
  const copy = () =>
    void navigator.clipboard
      ?.writeText(window.location.href)
      .then(() => toast.success(t("install.copied")))
      .catch(() => {});
  const install = async () => {
    if (!native) return;
    await native.prompt();
    await native.userChoice.catch(() => null);
    setNative(null);
    close();
  };

  const guide = {
    "in-app-browser": {
      title: t("install.inAppTitle"),
      description: t("install.inAppDescription", { browser }),
      steps: [t("install.stepOpenMenu"), t("install.stepOpenBrowser")],
    },
    "ios-open-safari": {
      title: t("install.openSafariTitle"),
      description: t("install.openSafariDescription", { browser }),
      steps: [
        t("install.stepCopyUrl"),
        t("install.stepOpenSafari"),
        t("install.stepShare"),
        t("install.stepAddHome"),
      ],
    },
    "ios-install": {
      title: t("install.iosTitle"),
      description: t("install.iosDescription"),
      steps: [
        t("install.stepShare"),
        t("install.stepAddHome"),
        t("install.stepOpenFromHome"),
      ],
    },
    "native-install": {
      title: t("install.androidTitle"),
      description: t("install.androidDescription"),
      steps: native
        ? [t("install.stepTapInstall"), t("install.stepOpenFromHome")]
        : [
            t("install.stepOpenMenu"),
            t("install.stepInstall"),
            t("install.stepOpenFromHome"),
          ],
    },
  }[mode];
  const step = confirming
    ? {
        title: t("install.dismissTitle"),
        description: t("install.dismissDescription"),
        steps: [] as string[],
      }
    : guide;

  return (
    <Dialog.Root open>
      <Dialog.Portal>
        <Dialog.Overlay className="t-overlay fixed inset-0 z-50 bg-[var(--backdrop)] backdrop-blur-[3px]" />
        <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center p-4">
          <Dialog.Content
            className="t-dialog surface-floating pointer-events-auto relative grid max-h-[calc(100dvh-2rem)] w-full max-w-md gap-5 overflow-y-auto p-6 outline-none sm:p-7"
            onEscapeKeyDown={(event) => event.preventDefault()}
            onInteractOutside={(event) => event.preventDefault()}
          >
            <div>
              <Dialog.Title className="type-section">{step.title}</Dialog.Title>
              <Dialog.Description className="mt-2 type-lead">
                {step.description}
              </Dialog.Description>
            </div>
            {step.steps.length > 0 && (
              <ol className="grid gap-3">
                {step.steps.map((line, index) => (
                  <li
                    className="flex items-start gap-3 text-[0.9375rem] leading-relaxed"
                    key={line}
                  >
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                      {index + 1}
                    </span>
                    <span className="pt-0.5">{line}</span>
                  </li>
                ))}
              </ol>
            )}
            {!confirming && mode !== "in-app-browser" && (
              <p className="rounded-[var(--radius-control)] bg-muted px-4 py-3 text-sm text-muted-foreground">
                {t("install.alreadyInstalled")}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              {confirming ? (
                <>
                  <Button variant="ghost" onClick={close}>
                    {t("install.dismissConfirm")}
                  </Button>
                  <Button onClick={() => setConfirming(false)}>
                    {t("install.dismissBack")}
                  </Button>
                </>
              ) : (
                <>
                  {mode !== "in-app-browser" && (
                    <Button variant="ghost" onClick={() => setConfirming(true)}>
                      {t("install.later")}
                    </Button>
                  )}
                  {mode === "native-install" && native ? (
                    <Button onClick={() => void install()}>
                      <Icons.export />
                      {t("install.install")}
                    </Button>
                  ) : mode === "in-app-browser" ||
                    mode === "ios-open-safari" ? (
                    <Button onClick={copy}>
                      <Icons.copy />
                      {t("install.copyUrl")}
                    </Button>
                  ) : null}
                </>
              )}
            </div>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

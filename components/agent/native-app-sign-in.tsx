import type { UserCredential } from "firebase/auth";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { agentWorkerUrl } from "@/lib/agent-client";
import { t } from "@/lib/i18n";
import { appCheckHeaders } from "@/src/lib/app-check";
import { getSameOriginAuth } from "@/src/lib/firebase";

/**
 * The native app cannot show the Google popup, so it opens this page with a
 * PKCE challenge. A fresh Google sign-in here yields a Google ID token, which
 * the worker keeps behind a one-time code; only the code travels back through
 * the redirect, and only the app holding the verifier can redeem it.
 */
const CHALLENGE = /^[A-Za-z0-9_-]{43}$/;
const PENDING_KEY = "lexiro:app-auth";

// Release builds use the lexiroapp scheme; Expo Go during development uses exp.
export function isAppRedirect(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "lexiroapp:" || url.protocol === "exp:";
  } catch {
    return false;
  }
}

async function handOff(
  result: UserCredential,
  challenge: string,
  redirect: string,
) {
  const { GoogleAuthProvider } = await import("firebase/auth");
  const googleIdToken =
    GoogleAuthProvider.credentialFromResult(result)?.idToken;
  if (!googleIdToken) throw new Error(t("appAuth.failed"));
  const response = await fetch(`${agentWorkerUrl()}/app-auth/codes`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await result.user.getIdToken()}`,
      "Content-Type": "application/json",
      ...(await appCheckHeaders()),
    },
    body: JSON.stringify({ challenge, googleIdToken }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(t("appAuth.failed"));
  const { code } = (await response.json()) as { code: string };
  const target = new URL(redirect);
  target.searchParams.set("code", code);
  window.location.replace(target.toString());
}

export function NativeAppSignIn({
  challenge,
  redirect,
}: {
  challenge: string;
  redirect: string;
}) {
  const valid = CHALLENGE.test(challenge) && isAppRedirect(redirect);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Coming back from the redirect fallback: finish where the popup would have.
  useEffect(() => {
    let pending: { challenge: string; redirect: string } | null = null;
    try {
      pending = JSON.parse(sessionStorage.getItem(PENDING_KEY) ?? "null");
      sessionStorage.removeItem(PENDING_KEY);
    } catch {
      pending = null;
    }
    if (!pending) return;
    setBusy(true);
    void (async () => {
      const auth = getSameOriginAuth();
      const { getRedirectResult } = await import("firebase/auth");
      const result = auth ? await getRedirectResult(auth) : null;
      if (!result || !pending) throw new Error(t("appAuth.failed"));
      await handOff(result, pending.challenge, pending.redirect);
    })().catch(() => {
      setError(t("appAuth.failed"));
      setBusy(false);
    });
  }, []);

  const signIn = async () => {
    setBusy(true);
    setError("");
    try {
      const auth = getSameOriginAuth();
      if (!auth) throw new Error(t("appAuth.failed"));
      const runtime = await import("firebase/auth");
      const provider = new runtime.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      try {
        await handOff(
          await runtime.signInWithPopup(auth, provider),
          challenge,
          redirect,
        );
      } catch (reason) {
        const code = (reason as { code?: string }).code;
        if (
          code !== "auth/popup-blocked" &&
          code !== "auth/operation-not-supported-in-this-environment"
        )
          throw reason;
        // Some in-app browser sheets refuse popups; a full redirect works there.
        sessionStorage.setItem(
          PENDING_KEY,
          JSON.stringify({ challenge, redirect }),
        );
        await runtime.signInWithRedirect(auth, provider);
      }
    } catch {
      setError(t("appAuth.failed"));
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-xl px-5 py-10 sm:py-16">
      <PageHeader
        title={t("appAuth.title")}
        footer={
          <p className="text-sm text-muted-foreground">
            {t(valid ? "appAuth.description" : "appAuth.invalid")}
          </p>
        }
      />
      {valid && (
        <Button disabled={busy} onClick={() => void signIn()}>
          {t("appAuth.signIn")}
        </Button>
      )}
      {error && (
        <p role="alert" className="mt-5 text-sm text-destructive">
          {error}
        </p>
      )}
    </main>
  );
}

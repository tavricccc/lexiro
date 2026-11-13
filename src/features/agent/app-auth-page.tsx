import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { GoogleLogo } from "@phosphor-icons/react";
import type { UserCredential } from "firebase/auth";
import { Button, EmptyState, Panel, type ActionStatus } from "design-kit";
import { appCheckHeaders } from "@/data/app-check";
import { sameOriginAuth } from "@/data/auth";
import { workerUrl } from "@/data/config";
import { Brand } from "@/ui/brand";
import { Page } from "@/ui/page";

/**
 * The native app cannot show the Google popup, so it opens this page with a
 * PKCE challenge. The Google ID token from a fresh sign-in stays with the
 * Worker behind a one-time code; only the code goes back through the redirect,
 * and only the app holding the verifier can redeem it.
 */
const CHALLENGE = /^[A-Za-z0-9_-]{43}$/;
const PENDING_KEY = "lexiro:app-auth";
const FAILED = "登入失敗，請回到 App 再試一次。";

/** Release builds use the lexiroapp scheme; Expo Go uses exp. */
function isAppRedirect(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "lexiroapp:" || protocol === "exp:";
  } catch {
    return false;
  }
}

async function handOff(result: UserCredential, challenge: string, redirect: string) {
  const { GoogleAuthProvider } = await import("firebase/auth");
  const googleIdToken = GoogleAuthProvider.credentialFromResult(result)?.idToken;
  if (!googleIdToken) throw new Error(FAILED);
  const response = await fetch(`${workerUrl}/app-auth/codes`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await result.user.getIdToken()}`, "Content-Type": "application/json", ...(await appCheckHeaders()) },
    body: JSON.stringify({ challenge, googleIdToken }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(FAILED);
  const { code } = (await response.json()) as { code: string };
  const target = new URL(redirect);
  target.searchParams.set("code", code);
  window.location.replace(target.toString());
}

export default function AppAuthPage() {
  const [query] = useSearchParams();
  const challenge = query.get("challenge") ?? "";
  const redirect = query.get("redirect") ?? "";
  const valid = CHALLENGE.test(challenge) && isAppRedirect(redirect);
  const [status, setStatus] = useState<ActionStatus>("idle");
  const [error, setError] = useState("");

  // Back from the redirect fallback: finish where the popup would have.
  useEffect(() => {
    let pending: { challenge: string; redirect: string } | null = null;
    try {
      pending = JSON.parse(sessionStorage.getItem(PENDING_KEY) ?? "null");
    } catch { /* unreadable: start over */ }
    sessionStorage.removeItem(PENDING_KEY);
    if (!pending) return;
    const saved = pending;
    setStatus("loading");
    void (async () => {
      const auth = sameOriginAuth();
      const { getRedirectResult } = await import("firebase/auth");
      const result = auth ? await getRedirectResult(auth) : null;
      if (!result) throw new Error(FAILED);
      await handOff(result, saved.challenge, saved.redirect);
    })().catch(() => { setError(FAILED); setStatus("idle"); });
  }, []);

  const start = async () => {
    setStatus("loading");
    setError("");
    try {
      const auth = sameOriginAuth();
      if (!auth) throw new Error(FAILED);
      const runtime = await import("firebase/auth");
      const provider = new runtime.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      try {
        await handOff(await runtime.signInWithPopup(auth, provider), challenge, redirect);
      } catch (reason) {
        const code = (reason as { code?: string } | null)?.code;
        if (code !== "auth/popup-blocked" && code !== "auth/operation-not-supported-in-this-environment") throw reason;
        // In-app browser sheets may refuse popups; a full redirect works there.
        sessionStorage.setItem(PENDING_KEY, JSON.stringify({ challenge, redirect }));
        await runtime.signInWithRedirect(auth, provider);
      }
    } catch {
      setError(FAILED);
      setStatus("idle");
    }
  };

  return (
    <div className="mx-auto grid w-full max-w-xl gap-6 px-[var(--gutter)] pb-12 pt-[calc(var(--safe-top)+1.5rem)]">
      <Brand />
      <Page title="登入 Lexiro App">
        {!valid ? (
          <EmptyState description="這個登入連結不完整，請回到 App 重新開始。" title="無效的連結" />
        ) : (
          <Panel className="grid gap-3">
            <p className="text-[0.9375rem] text-ink-muted">用 Google 登入後會自動回到 App。</p>
            <Button className="justify-self-start" onClick={() => void start()} size="lg" status={status} variant="primary"><GoogleLogo weight="bold" />用 Google 登入</Button>
            {error && <p className="text-sm text-danger" role="alert">{error}</p>}
          </Panel>
        )}
      </Page>
    </div>
  );
}

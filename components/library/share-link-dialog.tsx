"use client";

import { useEffect, useState } from "react";
import { Dialog } from "radix-ui";

import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { SignInRequired } from "@/components/ui/sign-in-required";
import { t } from "@/lib/i18n";
import {
  createSetShareLink,
  findSetShareLink,
  revokeSetShareLink,
  shareLinkUrl,
  type SetShareLink,
} from "@/lib/share-client";
import { useCloudStore } from "@/stores/cloud-store";

export function ShareLinkDialog({
  open,
  onOpenChange,
  setId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  setId: string;
}) {
  const user = useCloudStore((store) => store.user);
  const [link, setLink] = useState<SetShareLink | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const uid = user?.uid;

  useEffect(() => {
    setLink(null);
    setError("");
    setCopied(false);
    if (!open || !uid) return;
    const controller = new AbortController();
    setLoading(true);
    findSetShareLink(setId, controller.signal)
      .then((found) => {
        if (!controller.signal.aborted) setLink(found);
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(reason instanceof Error ? reason.message : String(reason));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [open, setId, uid]);

  const act = async (action: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };
  const url = link ? shareLinkUrl(link.id) : "";

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        if (!busy) onOpenChange(value);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="t-overlay fixed inset-0 z-50 bg-[var(--backdrop)] backdrop-blur-[3px]" />
        <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center p-4">
          <Dialog.Content className="t-dialog surface-floating pointer-events-auto w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto p-6 outline-none sm:p-7">
            <Dialog.Title className="type-section">{t("share.title")}</Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-muted-foreground">
              {t("share.description")}
            </Dialog.Description>
            <div className="mt-5">
              {!user ? (
                <SignInRequired message={t("share.signInRequired")} />
              ) : loading ? (
                <p role="status" className="text-sm text-muted-foreground">
                  <Icons.loading
                    aria-hidden
                    className="mr-2 inline size-4 animate-spin motion-reduce:animate-none"
                  />
                  {t("common.loading")}
                </p>
              ) : link ? (
                <div className="space-y-3">
                  <label className="block text-sm" htmlFor="share-link-url">
                    {t("share.linkLabel")}
                  </label>
                  <Input
                    id="share-link-url"
                    readOnly
                    value={url}
                    onFocus={(event) => event.currentTarget.select()}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(url);
                          setCopied(true);
                        } catch {
                          setError(t("share.copyFailed"));
                        }
                      }}
                    >
                      <Icons.copy />
                      {t(copied ? "share.copied" : "share.copy")}
                    </Button>
                    <Button
                      disabled={busy}
                      variant="outline"
                      onClick={() =>
                        void act(async () => {
                          await revokeSetShareLink(link.id);
                          setLink(null);
                          setCopied(false);
                        })
                      }
                    >
                      {t("share.revoke")}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("share.revokeHint")}
                  </p>
                </div>
              ) : (
                <Button
                  disabled={busy}
                  onClick={() =>
                    void act(async () => setLink(await createSetShareLink(setId)))
                  }
                >
                  <Icons.shareLink />
                  {t(busy ? "share.creating" : "share.create")}
                </Button>
              )}
            </div>
            {error && (
              <p role="alert" className="mt-4 text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="mt-6 flex justify-end">
              <Dialog.Close asChild>
                <Button disabled={busy} variant="ghost">
                  {t("share.close")}
                </Button>
              </Dialog.Close>
            </div>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

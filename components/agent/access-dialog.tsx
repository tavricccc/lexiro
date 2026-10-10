"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog } from "radix-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icons } from "@/components/ui/icons";
import { ListSection, ListPicker } from "@/components/ui/list";
import {
  agentJson,
  generateAgentLink,
  type AgentLink,
} from "@/lib/agent-client";
import { t } from "@/lib/i18n";
import { useCloudStore } from "@/stores/cloud-store";

export function AgentAccessDialog({
  open,
  onOpenChange,
  setId,
  createSet,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  setId?: string;
  createSet?: () => Promise<string>;
}) {
  const user = useCloudStore((store) => store.user);
  const [duration, setDuration] = useState("7200");
  const [link, setLink] = useState<(AgentLink & { url: string }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const createdId = useRef<string | undefined>(undefined);
  const currentUid = useRef(user?.uid);
  currentUid.current = user?.uid;
  useEffect(() => {
    setLink(null);
    setError("");
    setCopied(false);
    createdId.current = undefined;
  }, [user?.uid, setId]);
  const generate = async () => {
    const uid = user?.uid;
    setBusy(true);
    setError("");
    setCopied(false);
    try {
      const target = setId ?? createdId.current ?? (await createSet?.());
      if (!target) throw new Error(t("agent.requestFailed"));
      if (currentUid.current !== uid)
        throw new Error(t("agent.accountChanged"));
      createdId.current = target;
      const result = await generateAgentLink(target, Number(duration));
      if (currentUid.current === uid) setLink(result);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : t("agent.requestFailed"),
      );
    } finally {
      setBusy(false);
    }
  };
  const revoke = async () => {
    if (!link) return;
    setBusy(true);
    setError("");
    try {
      await agentJson(`/links/${link.id}`, { method: "DELETE" });
      setLink(null);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : t("agent.requestFailed"),
      );
    } finally {
      setBusy(false);
    }
  };
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
            <Dialog.Title className="type-section">
              {t("agent.generateUrl")}
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-muted-foreground">
              {t(setId ? "agent.linkDescription" : "agent.newLinkDescription")}
            </Dialog.Description>
            <p className="my-5 text-sm">{t("agent.fullPermission")}</p>
            {!user ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {t("agent.signInRequired")}
                </p>
                <Button
                  onClick={() =>
                    void useCloudStore
                      .getState()
                      .signIn()
                      .catch((reason) => setError(String(reason)))
                  }
                >
                  {t("agent.signIn")}
                </Button>
              </div>
            ) : link ? (
              <div className="space-y-3">
                <label className="block text-sm" htmlFor="agent-access-url">
                  {t("agent.linkLabel")}
                </label>
                <Input
                  id="agent-access-url"
                  readOnly
                  value={link.url}
                  onFocus={(event) => event.currentTarget.select()}
                />
                <p className="text-xs text-muted-foreground">
                  {t("agent.expiresAt", {
                    time: new Date(link.expiresAt).toLocaleString("zh-TW"),
                  })}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(link.url);
                        setCopied(true);
                      } catch {
                        setError(t("agent.copyFailed"));
                      }
                    }}
                  >
                    <Icons.copy />
                    {t(copied ? "agent.copied" : "agent.copy")}
                  </Button>
                  <Button
                    disabled={busy}
                    variant="outline"
                    onClick={() => void revoke()}
                  >
                    {t("agent.revoke")}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <ListSection>
                  <ListPicker
                    label={t("agent.duration")}
                    value={duration}
                    onChange={setDuration}
                    disabled={busy}
                    options={[
                      { value: "1800", label: t("agent.thirtyMinutes") },
                      { value: "7200", label: t("agent.twoHours") },
                      { value: "21600", label: t("agent.sixHours") },
                    ]}
                  />
                </ListSection>
                <Button disabled={busy} onClick={() => void generate()}>
                  <Icons.ai />
                  {t(busy ? "agent.generating" : "agent.generateUrl")}
                </Button>
              </div>
            )}
            {error && (
              <p role="alert" className="mt-4 text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="mt-6 flex justify-end">
              <Dialog.Close asChild>
                <Button disabled={busy} variant="ghost">
                  {t("agent.close")}
                </Button>
              </Dialog.Close>
            </div>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

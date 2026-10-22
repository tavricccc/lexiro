import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { t } from "@/lib/i18n";
import { useCloudStore } from "@/stores/cloud-store";

/** Every networked feature asks for an account; this is how it asks. */
export function SignInRequired({ message }: { message: string }) {
  const configured = useCloudStore((store) => store.configured);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="rounded-[var(--radius-card)] bg-card p-6 text-center">
      <Icons.signIn
        aria-hidden
        className="mx-auto size-6 text-muted-foreground"
      />
      <p className="mt-3 text-sm text-muted-foreground">
        {configured ? message : t("settings.notConfigured")}
      </p>
      {configured && (
        <Button
          className="mt-4"
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
          {t("settings.signIn")}
        </Button>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

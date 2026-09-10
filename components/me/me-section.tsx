import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import type { AutosaveStatus } from "@/components/me/use-autosave";
import { Icons } from "@/components/ui/icons";
import { t } from "@/lib/i18n";

export function MeSection({
  children,
  description,
  icon: Icon,
  status,
  title,
}: {
  children: ReactNode;
  description: string;
  icon: LucideIcon;
  status?: AutosaveStatus;
  title: string;
}) {
  return (
    <section className="border-t py-7 first:border-t-0 first:pt-0 sm:py-9">
      <div className="grid gap-5 sm:grid-cols-[13.5rem_minmax(0,1fr)] sm:gap-8">
        <div>
          <div className="flex items-center gap-2.5">
            <Icon aria-hidden className="size-4 text-muted-foreground" />
            <h2 className="font-lexical text-lg font-medium">{title}</h2>
          </div>
          <p className="mt-2 max-w-xs text-pretty text-sm leading-6 text-muted-foreground">
            {description}
          </p>
          {status && <SaveStatus status={status} />}
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </section>
  );
}

/**
 * One quiet line per section instead of a save button. It says what happened
 * and then gets out of the way, which is why it never occupies layout space it
 * would have to give back.
 */
function SaveStatus({ status }: { status: AutosaveStatus }) {
  return (
    <p
      aria-live="polite"
      className="mt-3 flex h-4 items-center gap-1.5 text-xs text-muted-foreground transition-opacity duration-[var(--motion-quick)]"
      style={{ opacity: status === "idle" ? 0 : 1 }}
    >
      {status === "saved" && (
        <Icons.success aria-hidden className="size-3.5 text-success" />
      )}
      {status === "idle" ? "" : t(status === "saved" ? "me.saved" : "me.saving")}
    </p>
  );
}

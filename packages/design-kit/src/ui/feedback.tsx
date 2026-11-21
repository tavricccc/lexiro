import { Toaster as Sonner } from "sonner";
import { Progress, ProgressIndicator, ProgressTrack } from "@ui-sdk/react/progress";
import { cn } from "../lib/utils";

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={cn("inline-block size-4 shrink-0 animate-spin rounded-none border-2 border-ink-faint/40 border-t-contrast [animation-duration:var(--motion-spin)]", className)}
      role={label ? "status" : undefined}
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cn("skeleton block rounded-none bg-surface-raised", className)} />;
}

export function ProgressBar({ className, label, value }: { className?: string; label: string; value: number }) {
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <Progress aria-label={label} className={cn("block", className)} max={100} min={0} value={percent}>
      <ProgressTrack className="h-2 overflow-hidden rounded-none border border-line-strong/20 bg-surface-raised">
        <ProgressIndicator
          className="h-full rounded-none bg-contrast transition-[width] duration-[var(--motion-control)] ease-[var(--ease-move)]"
          style={{ width: `${percent}%` }}
        />
      </ProgressTrack>
    </Progress>
  );
}

const toastClassNames = {
  toast: "!rounded-none !border !border-[var(--line-strong)] !bg-[var(--surface)] !text-ink !shadow-[var(--elevation-float)] !font-medium",
  ["description"]: "!text-ink-muted",
};

export function Toaster() {
  return (
    <Sonner
      mobileOffset={{ bottom: "calc(var(--bottom-nav-height) + var(--bottom-nav-gap) + 0.75rem)" }}
      position="bottom-right"
      theme="system"
      toastOptions={{ classNames: toastClassNames }}
    />
  );
}

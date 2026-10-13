"use client";

import {
  Check as CheckIcon,
  CircleNotch as Loader2Icon,
  Info as InfoIcon,
  Warning as TriangleAlertIcon,
  XCircle as OctagonXIcon,
} from "@phosphor-icons/react/ssr";
import { useEffect } from "react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, toast, type ToasterProps } from "sonner";

const DEFAULT_DURATION = 4000;
const GRACE_MS = 3000;

/**
 * Sonner pauses a toast while it is hovered, and a tap on a touch screen
 * counts as hover with no leave to follow, so the toast never times out.
 * Anything still showing well past its duration is dismissed here.
 */
function useToastWatchdog() {
  useEffect(() => {
    // Keyed by id and type, so a loading toast turned success restarts its clock.
    const seen = new Map<string, number>();
    const timer = setInterval(() => {
      const now = Date.now();
      const live = new Set<string>();
      for (const item of toast.getToasts()) {
        const type = "type" in item ? item.type : undefined;
        const key = `${item.id}:${type}`;
        live.add(key);
        if (!seen.has(key)) seen.set(key, now);
        const duration = "duration" in item ? item.duration : undefined;
        if (type === "loading" || duration === Infinity) continue;
        if (now - seen.get(key)! > (duration ?? DEFAULT_DURATION) + GRACE_MS)
          toast.dismiss(item.id);
      }
      for (const id of seen.keys()) if (!live.has(id)) seen.delete(id);
    }, 1000);
    return () => clearInterval(timer);
  }, []);
}

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();
  useToastWatchdog();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: "t-toast",
        },
      }}
      icons={{
        success: (
          <span className="t-success-check" data-state="in">
            <CheckIcon className="size-4" />
          </span>
        ),
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="t-spinner size-4" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };

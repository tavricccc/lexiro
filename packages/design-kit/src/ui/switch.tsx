import * as React from "react";
import { Switch as SwitchRoot, SwitchThumb } from "@ui-sdk/react/switch";
import { cn } from "../lib/utils";

export function Switch({ className, onCheckedChange, ...props }: Omit<React.ComponentProps<typeof SwitchRoot>, "onCheckedChange" | "className"> & {
  className?: string;
  onCheckedChange?: (checked: boolean) => void;
}) {
  return (
    <SwitchRoot
      className={cn(
        "relative inline-flex h-8 w-14 shrink-0 cursor-pointer items-center rounded-full border-2 border-line bg-surface-pressed p-0.5 outline-none transition-[background-color,border-color] duration-[var(--motion-control)] ease-[var(--ease-move)] focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)] data-checked:border-contrast-edge data-checked:bg-contrast data-disabled:opacity-40",
        className,
      )}
      onCheckedChange={(checked) => onCheckedChange?.(checked)}
      {...props}
    >
      <SwitchThumb className="size-6 rounded-full bg-surface shadow-[0_2px_0_rgb(0_0_0/18%)] transition-[translate] duration-[var(--motion-control)] ease-[var(--ease-bounce)] data-checked:translate-x-6" />
    </SwitchRoot>
  );
}

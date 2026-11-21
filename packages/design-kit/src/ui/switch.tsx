import * as React from "react";
import { Switch as SwitchPrimitive } from "radix-ui";
import { cn } from "../lib/utils";

export function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "inline-flex h-6 w-11 shrink-0 items-center rounded-none border border-line-strong bg-surface-raised p-0.5 outline-none transition-[background-color,border-color] duration-[var(--motion-control)] ease-[var(--ease-move)] focus-visible:ring-2 focus-visible:ring-contrast disabled:opacity-40 data-[state=checked]:border-contrast data-[state=checked]:bg-contrast",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="size-4 rounded-none bg-ink transition-[translate,background-color] duration-[var(--motion-control)] ease-[var(--ease-move)] data-[state=checked]:translate-x-5 data-[state=checked]:bg-on-contrast" />
    </SwitchPrimitive.Root>
  );
}

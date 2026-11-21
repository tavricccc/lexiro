import * as React from "react";
import { Switch as UISwitch, SwitchThumb } from "@ui-sdk/react/switch";
import { cn } from "../lib/utils";

export function Switch({
  checked,
  className,
  defaultChecked,
  disabled,
  onCheckedChange,
  ...props
}: Omit<React.ComponentProps<typeof UISwitch>, "onCheckedChange"> & {
  onCheckedChange?: (checked: boolean) => void;
}) {
  return (
    <UISwitch
      checked={checked}
      className={cn(
        "inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-none border border-line-strong bg-surface-raised p-0.5 outline-none transition-[background-color,border-color] duration-[var(--motion-control)] ease-[var(--ease-move)] focus-visible:ring-2 focus-visible:ring-contrast data-checked:border-contrast data-checked:bg-contrast data-disabled:cursor-default data-disabled:opacity-40",
        className,
      )}
      defaultChecked={defaultChecked}
      disabled={disabled}
      onCheckedChange={(next) => onCheckedChange?.(next)}
      {...props}
    >
      <SwitchThumb className="size-4 rounded-none bg-ink transition-[translate,background-color] duration-[var(--motion-control)] ease-[var(--ease-move)] data-checked:translate-x-5 data-checked:bg-on-contrast" />
    </UISwitch>
  );
}

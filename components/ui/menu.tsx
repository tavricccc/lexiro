import type { AppIcon } from "@/components/ui/icons";
import {
  ContextMenu as ContextPrimitive,
  DropdownMenu as MenuPrimitive,
} from "radix-ui";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";

const CONTENT_CLASS =
  "t-dropdown z-50 min-w-52 max-w-[calc(100vw-2rem)] origin-(--radix-dropdown-menu-content-transform-origin) rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-[var(--shadow-floating)]";

const itemClass = (action: MenuAction) =>
  cn(
    "flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground",
    action.tone === "destructive" &&
      "text-destructive focus:bg-destructive/10 focus:text-destructive [&_svg]:text-destructive",
  );

export interface MenuAction {
  disabled?: boolean;
  icon: AppIcon;
  label: string;
  onSelect: () => void;
  tone?: "default" | "destructive";
}

/**
 * The overflow menu for a page's secondary actions.
 *
 * A page header shows the one thing the screen is for, and everything else —
 * export, delete, rename, import — lives behind this. It exists so a toolbar
 * never has to spell out five equally loud buttons, which is what made every
 * destructive action one mis-tap away.
 */
export function Menu({
  actions,
  align = "end",
  label,
  trigger,
}: {
  actions: MenuAction[];
  align?: "start" | "end";
  label?: string;
  trigger?: ReactNode;
}) {
  const visible = actions.filter((action) => !action.disabled);
  if (visible.length === 0) return null;

  return (
    <MenuPrimitive.Root>
      <MenuPrimitive.Trigger asChild>
        {trigger ?? (
          <Button
            aria-label={label ?? t("common.more")}
            size="icon"
            type="button"
            variant="glass"
          >
            <Icons.more />
          </Button>
        )}
      </MenuPrimitive.Trigger>
      <MenuPrimitive.Portal>
        <MenuPrimitive.Content
          align={align}
          className={CONTENT_CLASS}
          collisionPadding={16}
          sideOffset={6}
        >
          {actions.map((action) => (
            <MenuPrimitive.Item
              className={itemClass(action)}
              disabled={action.disabled}
              key={action.label}
              onSelect={action.onSelect}
            >
              <action.icon aria-hidden />
              {action.label}
            </MenuPrimitive.Item>
          ))}
        </MenuPrimitive.Content>
      </MenuPrimitive.Portal>
    </MenuPrimitive.Root>
  );
}

/**
 * The same actions on a right click, or a long press on a touch screen, as
 * the app's context menus. The row keeps its own tap.
 */
export function ContextMenu({
  actions,
  children,
}: {
  actions: MenuAction[];
  children: ReactNode;
}) {
  return (
    <ContextPrimitive.Root>
      <ContextPrimitive.Trigger asChild>{children}</ContextPrimitive.Trigger>
      <ContextPrimitive.Portal>
        <ContextPrimitive.Content
          className={CONTENT_CLASS.replace(
            "--radix-dropdown-menu-content-transform-origin",
            "--radix-context-menu-content-transform-origin",
          )}
          collisionPadding={16}
        >
          {actions
            .filter((action) => !action.disabled)
            .map((action) => (
              <ContextPrimitive.Item
                className={itemClass(action)}
                key={action.label}
                onSelect={action.onSelect}
              >
                <action.icon aria-hidden />
                {action.label}
              </ContextPrimitive.Item>
            ))}
        </ContextPrimitive.Content>
      </ContextPrimitive.Portal>
    </ContextPrimitive.Root>
  );
}

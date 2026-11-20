import * as React from "react";
import type { Icon } from "@phosphor-icons/react";
import { Menu as MenuRoot, MenuContent, MenuItem as MenuItemPart, MenuTrigger } from "@ui-sdk/react/menu";
import { cn } from "../lib/utils";
import { AppLink } from "./app-link";
import { popupClass, sheetGrip } from "./popup";

export interface MenuItem {
  href?: string;
  icon: Icon;
  key: string;
  label: string;
  onSelect?: () => void;
  tone?: "default" | "danger";
}

const itemClass =
  "flex h-12 cursor-pointer items-center gap-3 rounded-xl px-3 text-[0.9375rem] font-semibold text-ink outline-none data-highlighted:bg-surface-raised [&_svg]:size-5 [&_svg]:text-ink-muted";

/** A popover off its trigger on a pointer screen; a swipeable sheet on a phone. */
export function Menu({ align = "end", description, items, title, trigger }: {
  align?: "center" | "end" | "start";
  description?: string;
  items: readonly MenuItem[];
  title: string;
  trigger: React.ReactElement;
}) {
  return (
    <MenuRoot presentation="auto">
      <MenuTrigger render={trigger} />
      <MenuContent align={align} aria-label={title} className={cn(popupClass, "min-w-56 p-1.5 data-[presentation=sheet]:p-3")} sideOffset={8}>
        {(state: { presentation?: string }) => (
          <>
            {state.presentation === "sheet" ? <div aria-hidden className={sheetGrip} /> : null}
            {description || state.presentation === "sheet" ? (
              <div className="px-3 pb-2 pt-1.5">
                <span className="block truncate font-extrabold">{title}</span>
                {description ? <span className="block truncate text-xs text-ink-muted">{description}</span> : null}
              </div>
            ) : null}
            {items.map(({ href, icon: ItemIcon, key, label, onSelect, tone }) => {
              const className = cn(itemClass, tone === "danger" && "text-danger [&_svg]:text-danger");
              const content = <><ItemIcon aria-hidden weight="bold" />{label}</>;
              return href ? (
                <MenuItemPart className={className} key={key} render={<AppLink href={href} />} value={key}>{content}</MenuItemPart>
              ) : (
                <MenuItemPart className={className} key={key} onSelect={() => onSelect?.()} value={key}>{content}</MenuItemPart>
              );
            })}
          </>
        )}
      </MenuContent>
    </MenuRoot>
  );
}

import * as React from "react";
import { AppLink } from "./app-link";
import type { Icon } from "@phosphor-icons/react";
import { DropdownMenu } from "radix-ui";
import { cn } from "../lib/utils";
import { ListGroup, ListRow } from "./list";
import { Sheet } from "./sheet";
import { useCompactViewport } from "./use-compact-viewport";

export interface MenuItem {
  href?: string;
  icon: Icon;
  key: string;
  label: string;
  onSelect?: () => void;
  tone?: "default" | "danger";
}

const itemClass =
  "flex h-11 cursor-pointer items-center gap-3 px-3.5 text-[0.9375rem] font-medium text-ink outline-none data-[highlighted]:bg-contrast data-[highlighted]:text-on-contrast [&_svg]:size-4 [&_svg]:text-ink-muted data-[highlighted]:[&_svg]:text-on-contrast";

export function Menu({
  align = "end",
  description,
  items,
  title,
  trigger,
}: {
  align?: "center" | "end" | "start";
  description?: string;
  items: readonly MenuItem[];
  title: string;
  trigger: React.ReactElement<{ onClick?: () => void }>;
}) {
  const compact = useCompactViewport();
  const [open, setOpen] = React.useState(false);

  if (compact) {
    return (
      <>
        {React.cloneElement(trigger, { onClick: () => setOpen(true) })}
        <Sheet description={description} onOpenChange={setOpen} open={open} title={title}>
          <ListGroup>
            {items.map(({ href, icon: ItemIcon, key, label, onSelect, tone }) =>
              href ? (
                <ListRow href={href} icon={<ItemIcon />} key={key} label={label} onClick={() => setOpen(false)} tone={tone} />
              ) : (
                <ListRow
                  icon={<ItemIcon />}
                  key={key}
                  label={label}
                  onClick={() => { setOpen(false); onSelect?.(); }}
                  tone={tone}
                />
              ),
            )}
          </ListGroup>
        </Sheet>
      </>
    );
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align}
          className="float-surface z-50 min-w-56 divide-y divide-line rounded-none border-2 border-line-strong bg-surface-solid text-ink shadow-float"
          sideOffset={4}
        >
          {description ? (
            <DropdownMenu.Label className="px-3.5 py-2.5">
              <span className="block truncate text-sm font-bold">{title}</span>
              <span className="block truncate font-mono text-xs text-ink-muted">{description}</span>
            </DropdownMenu.Label>
          ) : null}
          {items.map(({ href, icon: ItemIcon, key, label, onSelect, tone }) => {
            const content = <><ItemIcon aria-hidden className={cn(tone === "danger" && "!text-danger")} />{label}</>;
            const className = cn(itemClass, tone === "danger" && "text-danger data-[highlighted]:bg-danger data-[highlighted]:text-white");
            return href ? (
              <DropdownMenu.Item asChild className={className} key={key}>
                <AppLink href={href}>{content}</AppLink>
              </DropdownMenu.Item>
            ) : (
              <DropdownMenu.Item className={className} key={key} onSelect={onSelect}>{content}</DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

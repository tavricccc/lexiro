"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { t } from "@/lib/i18n";

type BackControlProps = {
  /** Accessible name for the icon-only return control. */
  label?: string;
} & (
  | {
      /**
       * Editors guard unsaved work behind a discard dialog. A back that leads
       * out of the editor on purpose says so, and leaves without the prompt.
       */
      allowDiscard?: boolean;
      href: string;
      onClick?: never;
    }
  | { allowDiscard?: never; href?: never; onClick: () => void }
);

/**
 * The one way out of a page that sits beneath another.
 *
 * Every screen that is not a destination needs it, so it is a component rather
 * than the same four lines written again at each one — a page that forgot it
 * left the reader with no way back but the browser.
 */
export function BackControl({ label, ...props }: BackControlProps) {
  const accessibleLabel = label ?? t("common.back");
  if (props.href) {
    return (
      <Button asChild size="icon" variant="ghost">
        <Link
          aria-label={accessibleLabel}
          data-allow-discard={props.allowDiscard ? "true" : undefined}
          href={props.href}
        >
          <Icons.back aria-hidden className="size-5" />
        </Link>
      </Button>
    );
  }
  return (
    <Button
      aria-label={accessibleLabel}
      onClick={props.onClick}
      size="icon"
      type="button"
      variant="ghost"
    >
      <Icons.back aria-hidden className="size-5" />
    </Button>
  );
}

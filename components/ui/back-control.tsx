"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { t } from "@/lib/i18n";

type BackControlProps = {
  /** Overrides the plain 返回 where the destination is worth naming. */
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
  const content = (
    <>
      <Icons.back />
      {label ?? t("common.back")}
    </>
  );
  if (props.href) {
    return (
      <Button asChild size="sm" variant="ghost">
        <Link
          data-allow-discard={props.allowDiscard ? "true" : undefined}
          href={props.href}
        >
          {content}
        </Link>
      </Button>
    );
  }
  return (
    <Button onClick={props.onClick} size="sm" type="button" variant="ghost">
      {content}
    </Button>
  );
}

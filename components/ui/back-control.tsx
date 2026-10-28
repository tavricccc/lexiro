import Link from "@/components/ui/app-link";

import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { t } from "@/lib/i18n";
import { markRouteDirection, markViewDirection } from "@/lib/navigation-memory";

type BackControlProps = {
  /** Accessible name for the icon-only return control. */
  label?: string;
  /**
   * A page beneath another goes back with a chevron; a full-screen flow such
   * as a practice session is closed instead, with a cross, as in the app.
   */
  icon?: "back" | "close";
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
export function BackControl({ icon = "back", label, ...props }: BackControlProps) {
  const accessibleLabel = label ?? t("common.back");
  const Glyph = icon === "close" ? Icons.cancel : Icons.back;
  if (props.href) {
    return (
      <Button asChild size="icon" variant="glass">
        <Link
          aria-label={accessibleLabel}
          data-allow-discard={props.allowDiscard ? "true" : undefined}
          href={props.href}
          onNavigate={() => markRouteDirection("back")}
        >
          <Glyph aria-hidden className="size-5" weight="bold" />
        </Link>
      </Button>
    );
  }
  return (
    <Button
      aria-label={accessibleLabel}
      onClick={() => {
        markViewDirection("back");
        props.onClick?.();
      }}
      size="icon"
      type="button"
      variant="glass"
    >
      <Glyph aria-hidden className="size-5" weight="bold" />
    </Button>
  );
}

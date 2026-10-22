import type { ComponentProps } from "react";
import { Link } from "react-router";

type AppLinkProps = Omit<ComponentProps<typeof Link>, "to"> & {
  href: string;
  /** Called before an in-app move; `preventDefault` keeps the page. */
  onNavigate?: (event: { preventDefault: () => void }) => void;
};

/**
 * A link that changes screens in place, and otherwise behaves as an ordinary
 * link. Modified clicks still open a tab.
 */
export default function AppLink({
  href,
  onClick,
  onNavigate,
  target,
  ...props
}: AppLinkProps) {
  return (
    <Link
      {...props}
      to={href}
      target={target}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || target || event.button !== 0) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
          return;
        onNavigate?.({ preventDefault: () => event.preventDefault() });
      }}
    />
  );
}

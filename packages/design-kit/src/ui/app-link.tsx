import type * as React from "react";
import { useNavigation } from "../lib/provider";

type AppLinkProps = Omit<React.ComponentProps<"a">, "href"> & {
  href: string;
  replace?: boolean;
  /** `href` is the parent screen: step back to it rather than piling up history. */
  back?: boolean;
};

/**
 * A link to a screen of this app (`/settings`) or, with a scheme, somewhere
 * else. In-app paths change screens in place through the app's navigation;
 * modified clicks and targeted links still behave as ordinary links.
 */
export function AppLink({ back, href, onClick, replace, target, ...props }: AppLinkProps) {
  const navigation = useNavigation();
  const inApp = href.startsWith("/");
  return (
    <a
      {...props}
      href={inApp ? navigation.href(href) : href}
      onClick={(event) => {
        onClick?.(event);
        if (!inApp || event.defaultPrevented || target || event.button !== 0) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        if (back) {
          event.preventDefault();
          if (navigation.back) navigation.back(href);
          else if (!navigation.navigate(href, { replace: true })) location.assign(navigation.href(href));
          return;
        }
        if (navigation.navigate(href, { replace })) event.preventDefault();
      }}
      target={target}
    />
  );
}

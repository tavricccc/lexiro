import { useMemo } from "react";
import { useNavigate } from "react-router";

import { preloadScreen } from "@/components/app-views";

/**
 * The router the app's screens use. Every address is drawn on the client;
 * `prefetch` fetches a screen's code ahead of the visit.
 */
export function useAppRouter() {
  const navigate = useNavigate();
  return useMemo(
    () => ({
      back: () => void navigate(-1),
      prefetch: (href: string) => preloadScreen(href),
      push: (href: string) => void navigate(href),
      replace: (href: string) => void navigate(href, { replace: true }),
    }),
    [navigate],
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";

import { navigate } from "@/lib/app-navigation";

/**
 * The router the app's screens use: in-app addresses change in place, and
 * only an address outside the app goes through Next. Nothing is prefetched,
 * because every screen already ships in the one client bundle.
 */
export function useAppRouter() {
  const router = useRouter();
  return useMemo(
    () => ({
      back: () => router.back(),
      prefetch: (_href: string) => {},
      push: (href: string) => {
        if (!navigate(href)) router.push(href);
      },
      replace: (href: string) => {
        if (!navigate(href, { replace: true })) router.replace(href);
      },
    }),
    [router],
  );
}

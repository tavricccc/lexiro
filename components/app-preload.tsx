"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const CORE_ROUTES = ["/", "/practice?mode=questions", "/library", "/questions/generate"];

export function AppPreload() {
  const router = useRouter();

  useEffect(() => {
    const preload = () => {
      for (const route of CORE_ROUTES) router.prefetch(route);
    };
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(preload, { timeout: 900 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(preload, 120);
    return () => clearTimeout(id);
  }, [router]);

  return (
    <link
      rel="preload"
      as="image"
      href="/illustrations/open-doodles-reading.svg"
      fetchPriority="high"
    />
  );
}

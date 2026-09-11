"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { AppPreload } from "@/components/app-preload";
import { NavigationFeedback } from "@/components/motion/navigation-feedback";
import { ResizeMotion } from "@/components/motion/resize-motion";
import { timing } from "@/lib/motion-timing";
import { useState, type ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false },
        },
      }),
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <MotionConfig reducedMotion="user" transition={timing("control")}>
        <TooltipProvider>
          <QueryClientProvider client={queryClient}>
            <AppPreload />
            {children}
            <NavigationFeedback />
            <ResizeMotion />
            <Toaster position="bottom-center" />
          </QueryClientProvider>
        </TooltipProvider>
      </MotionConfig>
    </ThemeProvider>
  );
}

import type { ComponentType } from "react";
import type { RouteObject } from "react-router";

import { RootLayout } from "./layout";
import { NotFoundPage } from "./not-found";
import { WorkspaceError } from "./app/error";
import { WorkspaceLayout } from "./app/layout";
import { screenRoutes } from "@/components/app-views";

const page = (load: () => Promise<{ default: ComponentType }>) => async () => ({
  Component: (await load()).default,
});

/** Every address the app answers, each page fetched when first visited. */
export const routes: RouteObject[] = [
  {
    Component: RootLayout,
    // The first page's code is still arriving; the page has nothing to show.
    HydrateFallback: () => null,
    ErrorBoundary: WorkspaceError,
    children: [
      {
        path: "/app",
        Component: WorkspaceLayout,
        // Inside the workspace a failed screen leaves the shell standing.
        children: [{ ErrorBoundary: WorkspaceError, children: screenRoutes }],
      },
      {
        path: "/agent/authorize",
        lazy: page(() => import("./agent/authorize/page")),
      },
      { path: "/app-auth", lazy: page(() => import("./app-auth/page")) },
      { path: "/~offline", lazy: page(() => import("./~offline/page")) },
      { path: "*", Component: NotFoundPage },
    ],
  },
];

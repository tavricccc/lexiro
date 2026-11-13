import type { ComponentType } from "react";
import { Navigate, useParams, type RouteObject } from "react-router";
import { RequireAccount, RootLayout } from "./root";
import { WorkspaceShell } from "./shell";
import { RouteError } from "./route-error";

/** A screen whose code is fetched on its first visit. */
const screen = (load: () => Promise<{ default: ComponentType }>) => async () => ({ Component: (await load()).default });

function SharedRedirect() {
  const { shareId = "" } = useParams();
  return <Navigate replace to={`/shared/${shareId}`} />;
}

export const routes: RouteObject[] = [
  {
    Component: RootLayout,
    HydrateFallback: () => null,
    ErrorBoundary: RouteError,
    children: [
      { path: "/", element: <Navigate replace to="/app" /> },
      { path: "/shared/:shareId", lazy: screen(() => import("@/features/share/shared-page")) },
      { path: "/app/shared/:shareId", Component: SharedRedirect },
      { path: "/agent/authorize", lazy: screen(() => import("@/features/agent/authorize-page")) },
      { path: "/app-auth", lazy: screen(() => import("@/features/agent/app-auth-page")) },
      { path: "/~offline", lazy: screen(() => import("@/features/system/offline-page")) },
      {
        path: "/app",
        Component: RequireAccount,
        children: [{
          Component: WorkspaceShell,
          children: [{
            ErrorBoundary: RouteError,
            children: [
              { index: true, lazy: screen(() => import("@/features/today/today-page")) },
              { path: "library", lazy: screen(() => import("@/features/library/library-page")) },
              { path: "sets/new", lazy: screen(() => import("@/features/library/new-set-page")) },
              { path: "sets/:setId", lazy: screen(() => import("@/features/library/set-page")) },
              { path: "sets/:setId/settings", lazy: screen(() => import("@/features/library/set-settings-page")) },
              { path: "sets/:setId/add", lazy: screen(() => import("@/features/library/add-words-page")) },
              { path: "sets/:setId/words/:wordId", lazy: screen(() => import("@/features/library/set-page")) },
              { path: "sets/:setId/words/:wordId/edit", lazy: screen(() => import("@/features/library/word-edit-page")) },
              { path: "sets/:setId/questions/:questionId", lazy: screen(() => import("@/features/questions/question-page")) },
              { path: "practice", lazy: screen(() => import("@/features/practice/setup-page")) },
              { path: "practice/run", lazy: screen(() => import("@/features/practice/run-page")) },
              { path: "progress", lazy: screen(() => import("@/features/progress/progress-page")) },
              { path: "rooms", lazy: screen(() => import("@/features/rooms/rooms-page")) },
              { path: "rooms/:code", lazy: screen(() => import("@/features/rooms/room-page")) },
              { path: "me", lazy: screen(() => import("@/features/me/me-page")) },
              { path: "me/account", lazy: screen(() => import("@/features/me/account-page")) },
              { path: "me/preferences", lazy: screen(() => import("@/features/me/preferences-page")) },
              { path: "me/data", lazy: screen(() => import("@/features/me/data-page")) },
              { path: "me/agents", lazy: screen(() => import("@/features/me/agents-page")) },
              { path: "me/about", lazy: screen(() => import("@/features/me/about-page")) },
              { path: "me/admin", lazy: screen(() => import("@/features/me/admin-page")) },
              { path: "*", lazy: screen(() => import("@/features/system/not-found-page")) },
            ],
          }],
        }],
      },
      { path: "*", lazy: screen(() => import("@/features/system/not-found-page")) },
    ],
  },
];

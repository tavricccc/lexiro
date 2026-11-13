import type { DataRouter } from "react-router";
import type { Navigation } from "design-kit";

type AppRouter = DataRouter;

/**
 * The kit's navigation over React Router. Back steps through history only
 * when the parent is the screen visited just before; otherwise it replaces,
 * so a deep link's back control never leaves the app.
 */
export function routerNavigation(router: AppRouter): Navigation {
  const here = () => router.state.location.pathname + router.state.location.search;
  const visited: string[] = [here()];
  router.subscribe((state) => {
    const now = state.location.pathname + state.location.search;
    if (now === visited.at(-1)) return;
    if (state.historyAction === "POP" && visited.at(-2) === now) visited.pop();
    else if (state.historyAction === "REPLACE") visited[visited.length - 1] = now;
    else visited.push(now);
  });
  return {
    href: (path) => path,
    navigate: (path, options) => {
      if (!path.startsWith("/")) return false;
      void router.navigate(path, { replace: options?.replace });
      return true;
    },
    back: (parent) => {
      const previous = visited.at(-2);
      if (previous && (previous === parent || previous.split("?")[0] === parent)) void router.navigate(-1);
      else void router.navigate(parent, { replace: true });
    },
  };
}

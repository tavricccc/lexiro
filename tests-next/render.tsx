import { createContext, useContext, useState, type ReactNode } from "react";
import {
  render as renderInDocument,
  type RenderOptions,
} from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";

const Content = createContext<ReactNode>(null);
const Page = () => useContext(Content);

/**
 * Renders `ui` the way the app does, inside a router, at `path`. Every
 * address shows `ui`, so a test can follow a link and read where it went from
 * `router.state.location`.
 */
export function render(
  ui: ReactNode,
  { path = "/app", ...options }: RenderOptions & { path?: string } = {},
) {
  const router = createMemoryRouter([{ path: "*", Component: Page }], {
    initialEntries: [path],
  });
  function Router({ children }: { children: ReactNode }) {
    const [instance] = useState(router);
    return (
      <Content.Provider value={children}>
        <RouterProvider router={instance} />
      </Content.Provider>
    );
  }
  return { ...renderInDocument(ui, { ...options, wrapper: Router }), router };
}

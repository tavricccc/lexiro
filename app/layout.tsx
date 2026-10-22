import { Outlet } from "react-router";

import { Providers } from "@/components/providers";

/** What every page sits in; the document head is index.html. */
export function RootLayout() {
  return (
    <Providers>
      <Outlet />
    </Providers>
  );
}

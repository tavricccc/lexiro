import { Navigate, useLocation } from "react-router";

import { ScreenNotFound } from "@/components/app-views";
import { legacyDestination } from "@/lib/legacy-redirects";

/** Follows an address from before /app, or says there is nothing here. */
export function NotFoundPage() {
  const { pathname, search, hash } = useLocation();
  const destination = legacyDestination(pathname);
  if (destination)
    return <Navigate replace to={`${destination}${search}${hash}`} />;
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <ScreenNotFound />
    </main>
  );
}

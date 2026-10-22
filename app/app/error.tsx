import { useLocation, useNavigate } from "react-router";

import { ErrorState } from "@/components/ui/page-state";
import { t } from "@/lib/i18n";

export function WorkspaceError() {
  const location = useLocation();
  const navigate = useNavigate();
  // Arriving at the same address again clears the error and redraws the page.
  const reset = () => void navigate(location, { replace: true });
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <ErrorState error={t("common.unexpectedError")} onRetry={reset} />
    </main>
  );
}

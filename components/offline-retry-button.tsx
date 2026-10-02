"use client";

import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

export function OfflineRetryButton() {
  return (
    <Button onClick={() => window.location.reload()}>
      {t("offline.retry")}
    </Button>
  );
}

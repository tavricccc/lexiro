import { useEffect, useState } from "react";

import { agentJson } from "@/lib/agent-client";
import { useCloudStore } from "@/stores/cloud-store";

/** Whether the signed-in account is an administrator; the Worker decides. */
export function useIsAdministrator(): boolean {
  const { user, ready } = useCloudStore();
  const [admin, setAdmin] = useState(false);
  const uid = user?.uid;
  useEffect(() => {
    setAdmin(false);
    if (!ready || !uid) return;
    let current = true;
    void agentJson<{ admin: boolean }>("/admin/status")
      .then((status) => current && setAdmin(status.admin))
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [ready, uid]);
  return admin;
}

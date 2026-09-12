"use client";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getManagedAccount, MANAGED_ACCOUNT_CHANGED } from "@/lib/managed-client";
import { useCloudStore } from "@/stores/cloud-store";
export function useManagedAccount() {
  const uid = useCloudStore((store) => store.user?.uid);
  const ready = useCloudStore((store) => store.ready);
  const client = useQueryClient();
  useEffect(() => {
    const refresh = () => { void client.invalidateQueries({ queryKey: ["managed-account", uid] }); };
    window.addEventListener(MANAGED_ACCOUNT_CHANGED, refresh);
    return () => window.removeEventListener(MANAGED_ACCOUNT_CHANGED, refresh);
  }, [client, uid]);
  return useQuery({ queryKey: ["managed-account", uid], queryFn: getManagedAccount, enabled: ready && Boolean(uid), staleTime: 30_000, retry: false });
}

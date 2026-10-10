"use client";

import { getFirebaseAuth } from "@/src/lib/firebase";
import { useCloudStore } from "@/stores/cloud-store";
import { t } from "@/lib/i18n";

export const agentWorkerUrl = () =>
  process.env.NEXT_PUBLIC_AGENT_WORKER_URL?.trim().replace(/\/$/, "") ?? "";
export interface AgentLink {
  id: string;
  setId: string;
  expiresAt: number;
  revokedAt: number | null;
  url?: string;
}
export interface AgentConnection {
  id: string;
  clientId: string;
  clientName: string;
  createdAt: number;
}

export async function agentJson<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const base = agentWorkerUrl();
  if (!base) throw new Error(t("agent.unavailable"));
  const auth = getFirebaseAuth();
  await auth?.authStateReady();
  const user = auth?.currentUser;
  if (!user || useCloudStore.getState().user?.uid !== user.uid)
    throw new Error(t("agent.signInRequired"));
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await user.getIdToken(attempt > 0);
    if (auth.currentUser?.uid !== user.uid)
      throw new Error(t("agent.accountChanged"));
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    headers.set("Content-Type", "application/json");
    const response = await fetch(`${base}${path}`, {
      ...init,
      headers,
      cache: "no-store",
      signal: init.signal ?? AbortSignal.timeout(30000),
    });
    if (response.status === 401 && attempt === 0) continue;
    if (auth.currentUser?.uid !== user.uid)
      throw new Error(t("agent.accountChanged"));
    const value = await response.json();
    if (!response.ok) {
      const code = value.error?.code;
      throw new Error(
        code === "set_not_found" || code === "set_sync_incomplete"
          ? t("agent.syncFirst")
          : code === "authorization_expired"
            ? t("agent.authorizationExpired")
            : (value.error?.message ?? t("agent.requestFailed")),
      );
    }
    return value as T;
  }
  throw new Error(t("agent.requestFailed"));
}

export async function generateAgentLink(
  setId: string,
  expiresInSeconds: number,
) {
  const uid = useCloudStore.getState().user?.uid;
  await useCloudStore.getState().sync({ reconcileAccount: true });
  const cloud = useCloudStore.getState();
  if (cloud.user?.uid !== uid) throw new Error(t("agent.accountChanged"));
  if (cloud.status !== "synced" || cloud.pending > 0)
    throw new Error(t("agent.syncFirst"));
  return agentJson<AgentLink & { url: string }>("/links", {
    method: "POST",
    body: JSON.stringify({ setId, expiresInSeconds }),
  });
}

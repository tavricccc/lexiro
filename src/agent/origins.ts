import type { AgentEnv } from "./types";

/** The production app, plus any extra app origins such as a beta site. */
export function isAppOrigin(env: Pick<AgentEnv, "APP_ORIGIN" | "EXTRA_APP_ORIGINS">, origin: string | null): boolean {
  if (!origin) return false;
  if (origin === env.APP_ORIGIN) return true;
  return (env.EXTRA_APP_ORIGINS ?? "").split(",").map((entry) => entry.trim()).filter(Boolean).includes(origin);
}

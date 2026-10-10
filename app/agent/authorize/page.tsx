import { AgentOAuthConsent } from "@/components/agent/oauth-consent";
export const metadata = { title: "連結 Lexiro" };
export default async function AgentAuthorizationPage({
  searchParams,
}: {
  searchParams: Promise<{ request?: string }>;
}) {
  const { request = "" } = await searchParams;
  return <AgentOAuthConsent requestId={request} />;
}

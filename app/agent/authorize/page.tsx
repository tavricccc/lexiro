import { useSearchParams } from "react-router";

import { AgentOAuthConsent } from "@/components/agent/oauth-consent";
import { useDocumentTitle } from "@/lib/use-document-title";

export default function AgentAuthorizationPage() {
  useDocumentTitle("連結 Lexiro");
  const [query] = useSearchParams();
  return <AgentOAuthConsent requestId={query.get("request") ?? ""} />;
}

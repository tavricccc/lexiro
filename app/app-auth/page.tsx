import { useSearchParams } from "react-router";

import { NativeAppSignIn } from "@/components/agent/native-app-sign-in";
import { useDocumentTitle } from "@/lib/use-document-title";

export default function NativeAppSignInPage() {
  useDocumentTitle("登入 Lexiro App");
  const [query] = useSearchParams();
  return (
    <NativeAppSignIn
      challenge={query.get("challenge") ?? ""}
      redirect={query.get("redirect") ?? ""}
    />
  );
}

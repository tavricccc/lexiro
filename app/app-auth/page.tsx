import { NativeAppSignIn } from "@/components/agent/native-app-sign-in";
export const metadata = { title: "登入 Lexiro App" };
export default async function NativeAppSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ challenge?: string; redirect?: string }>;
}) {
  const { challenge = "", redirect = "" } = await searchParams;
  return <NativeAppSignIn challenge={challenge} redirect={redirect} />;
}

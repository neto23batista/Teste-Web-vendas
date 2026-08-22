import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string | string[] }>;
}) {
  const query = await searchParams;
  const callbackUrl =
    typeof query.callbackUrl === "string" ? query.callbackUrl : undefined;
  return <LoginForm callbackUrl={callbackUrl} />;
}

import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = { title: "Criar conta" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string | string[] }>;
}) {
  const query = await searchParams;
  const callbackUrl =
    typeof query.callbackUrl === "string" ? query.callbackUrl : undefined;
  return <RegisterForm callbackUrl={callbackUrl} />;
}

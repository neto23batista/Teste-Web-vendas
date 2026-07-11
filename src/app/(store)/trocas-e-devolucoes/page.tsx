import type { Metadata } from "next";
import { getStoreSettings } from "@/lib/settings";
import { SimpleMarkdown } from "@/components/store/simple-markdown";

export const metadata: Metadata = {
  title: "Trocas e Devoluções",
  description:
    "Termos de troca e devolução da FarmaVida, em conformidade com o Código de Defesa do Consumidor.",
};

export default async function ReturnPolicyPage() {
  const { returnPolicy } = await getStoreSettings();

  return (
    <div className="container-page max-w-3xl space-y-6 py-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-extrabold md:text-4xl">
          Trocas e Devoluções
        </h1>
        <p className="text-sm text-muted-foreground">
          Seus direitos de troca, devolução e arrependimento.
        </p>
      </header>
      <SimpleMarkdown source={returnPolicy} />
    </div>
  );
}

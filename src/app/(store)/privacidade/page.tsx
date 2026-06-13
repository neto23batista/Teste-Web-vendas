import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description: "Como a FarmaVida coleta, usa e protege seus dados pessoais (LGPD).",
};

const sections = [
  {
    h: "1. Coleta de dados",
    p: "Coletamos apenas os dados necessários para processar seus pedidos e melhorar sua experiência: nome, e-mail, CPF, telefone, endereço de entrega e histórico de compras.",
  },
  {
    h: "2. Uso das informações",
    p: "Utilizamos seus dados para confirmar e entregar pedidos, validar receitas, oferecer suporte e, com seu consentimento, enviar comunicações sobre ofertas.",
  },
  {
    h: "3. Receitas médicas",
    p: "Documentos enviados para validação farmacêutica são tratados de forma confidencial e utilizados exclusivamente para a dispensação de medicamentos.",
  },
  {
    h: "4. Compartilhamento",
    p: "Não vendemos seus dados. Compartilhamos informações apenas com parceiros essenciais (pagamento e entrega) e quando exigido por lei.",
  },
  {
    h: "5. Seus direitos (LGPD)",
    p: "Você pode acessar, corrigir ou solicitar a exclusão dos seus dados a qualquer momento, além de revogar consentimentos. Faça você mesmo em Minha conta → Privacidade: baixe uma cópia completa dos seus dados ou exclua sua conta definitivamente — ou fale com nossos canais de atendimento.",
  },
];

export default function PrivacyPage() {
  return (
    <div className="container-page max-w-3xl space-y-6 py-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-extrabold md:text-4xl">Política de Privacidade</h1>
        <p className="text-sm text-muted-foreground">
          Em conformidade com a Lei Geral de Proteção de Dados (LGPD).
        </p>
      </header>
      <div className="space-y-5">
        {sections.map((s) => (
          <section key={s.h} className="space-y-1.5">
            <h2 className="text-lg font-bold">{s.h}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{s.p}</p>
          </section>
        ))}
      </div>
    </div>
  );
}

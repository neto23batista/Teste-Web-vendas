import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Termos de Uso",
  description: "Termos e condições de uso da plataforma FarmaVida.",
};

const sections = [
  { h: "1. Aceitação", p: "Ao utilizar a FarmaVida, você concorda com estes Termos de Uso e com a nossa Política de Privacidade." },
  { h: "2. Cadastro", p: "Você é responsável pela veracidade dos dados informados e pela guarda das suas credenciais de acesso." },
  { h: "3. Pedidos e pagamentos", p: "Os preços e a disponibilidade podem mudar sem aviso prévio. O pedido é confirmado após a aprovação do pagamento." },
  { h: "4. Medicamentos sob prescrição", p: "A FarmaVida não comercializa medicamentos que exigem receita médica. Nosso catálogo é composto exclusivamente por produtos de venda livre." },
  { h: "5. Entregas e trocas", p: "Prazos de entrega são estimados. Trocas e devoluções seguem o Código de Defesa do Consumidor e a legislação sanitária." },
  { h: "6. Limitação de responsabilidade", p: "A FarmaVida não se responsabiliza pelo uso inadequado de produtos. Sempre leia a bula e siga a orientação profissional." },
];

export default function TermsPage() {
  return (
    <div className="container-page max-w-3xl space-y-6 py-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-extrabold md:text-4xl">Termos de Uso</h1>
        <p className="text-sm text-muted-foreground">Última atualização: {new Date().toLocaleDateString("pt-BR")}</p>
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

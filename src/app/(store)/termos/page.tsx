import type { Metadata } from "next";
import { formatPolicyVersion, TERMS_VERSION } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Termos de Uso",
  description: "Termos e condições de uso da plataforma FarmaVida.",
};

const sections = [
  { h: "1. Aceitação", p: "Ao utilizar a FarmaVida, você concorda com estes Termos de Uso e com a nossa Política de Privacidade." },
  { h: "2. Cadastro", p: "Você é responsável pela veracidade dos dados informados e pela guarda das suas credenciais de acesso." },
  { h: "3. Pedidos e pagamentos", p: "Antes da confirmação, a loja apresenta itens, descontos, frete e total. O preço aceito fica registrado no pedido. Pagamentos online só são confirmados após retorno autenticado do provedor; disponibilidade e ofertas futuras podem mudar." },
  { h: "4. Medicamentos sob prescrição", p: "A FarmaVida não comercializa medicamentos que exigem receita médica. Nosso catálogo é composto exclusivamente por produtos de venda livre." },
  { h: "5. Entregas, cancelamentos e trocas", p: "Prazo, modalidade e custo são exibidos antes da compra e podem depender do CEP. Cancelamentos, arrependimento, trocas e devoluções observam o Código de Defesa do Consumidor, as condições informadas no pedido e as restrições sanitárias aplicáveis, sem reduzir direitos legais." },
  { h: "6. Limitação de responsabilidade", p: "A FarmaVida não se responsabiliza pelo uso inadequado de produtos. Sempre leia a bula e siga a orientação profissional." },
  { h: "7. Conta e segurança", p: "Não compartilhe credenciais. Avise imediatamente pelos canais publicados se suspeitar de acesso indevido. A loja pode bloquear operações suspeitas enquanto verifica fraude ou protege usuários, preservado o atendimento e os direitos aplicáveis." },
  { h: "8. Privacidade e atendimento", p: "O tratamento de dados segue a Política de Privacidade vigente. A identificação legal, o endereço e os canais oficiais da operação são publicados no rodapé e na página Sobre; ambientes sem esses dados não estão liberados para vendas." },
];

export default function TermsPage() {
  return (
    <div className="container-page max-w-3xl space-y-6 py-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-extrabold md:text-4xl">Termos de Uso</h1>
        <p className="text-sm text-muted-foreground">
          Versão {TERMS_VERSION} · última atualização: {formatPolicyVersion(TERMS_VERSION)}
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

import type { Metadata } from "next";
import { formatPolicyVersion, PRIVACY_VERSION } from "@/lib/legal";
import { getStoreSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description: "Como a FarmaVida coleta, usa e protege seus dados pessoais (LGPD).",
};

const sections = [
  {
    h: "1. Coleta de dados",
    p: "Conforme o uso, tratamos identificação e contato (nome, e-mail, CPF e telefone), endereços, carrinho, pedidos, pagamentos e reembolsos, fidelidade, favoritos, assinaturas e avaliações. Para proteger e operar o serviço, também tratamos sessão, endereço IP, limites de tentativa, MFA administrativo, aceites de políticas, eventos de auditoria e dados técnicos de acesso. Documentos de saúde existem apenas no acervo legado descrito abaixo.",
  },
  {
    h: "2. Finalidades e bases legais",
    p: "Tratamos os dados para criar e proteger a conta, executar a compra e a entrega, atender solicitações, prevenir fraude e cumprir obrigações fiscais, sanitárias, consumeristas e regulatórias. Conforme a atividade, o tratamento se apoia na execução do contrato, no cumprimento de obrigação legal ou regulatória, no exercício regular de direitos, em interesses legítimos avaliados e, quando necessário, no consentimento.",
  },
  {
    h: "3. Receitas médicas",
    p: "A FarmaVida não comercializa medicamentos sob prescrição e não recebe novas receitas. Documentos enviados antes da descontinuação desse serviço seguem em armazenamento privado, com acesso restrito. O titular autenticado pode baixá-los em Minha conta → Privacidade e solicitar eliminação pelo canal do controlador ou ao excluir a conta, ressalvada eventual preservação obrigatória avaliada para o caso.",
  },
  {
    h: "4. Compartilhamento",
    p: "Não vendemos dados pessoais. Compartilhamos o necessário com operadores de entrega; ViaCEP quando a consulta de CEP é usada; e fornecedores de hospedagem, banco de dados, armazenamento, e-mail, monitoramento, métricas e suporte. Quando o pagamento online estiver habilitado, os dados estritamente necessários também serão tratados pelo provedor financeiro para processar a transação e prevenir fraude; a loja não armazenará o número completo do cartão. Dados também podem ser apresentados a autoridades quando houver dever legal.",
  },
  {
    h: "5. Retenção e eliminação",
    p: "Tokens de redefinição expiram em uma hora e contadores antifraude expiram com sua janela de segurança. Carrinhos convidados, telemetria operacional e dados temporários são eliminados em rotinas periódicas. Cadastro e preferências ficam enquanto a conta existir. Pedidos, pagamentos, aceites e evidências de auditoria seguem o registro interno de retenção aprovado para obrigações fiscais, consumeristas, regulatórias e exercício de direitos; o prazo aplicável pode ser informado pelo canal do controlador. Ao excluir a conta, eliminamos ou anonimizamos o restante. Backups deixam o ciclo ativo conforme a retenção segura do provedor.",
  },
  {
    h: "6. Segurança e incidentes",
    p: "Aplicamos controle de acesso por função e unidade, autenticação, limitação de tentativas, armazenamento privado, trilhas de auditoria, atualizações e monitoramento. Nenhuma medida elimina todo risco. Incidentes com risco ou dano relevante serão avaliados e comunicados aos titulares e à ANPD quando a legislação exigir.",
  },
  {
    h: "7. Seus direitos (LGPD)",
    p: "Você pode pedir confirmação e acesso, correção, informação sobre compartilhamento, portabilidade quando aplicável, oposição, anonimização, bloqueio ou eliminação de dados irregulares, além de revogar consentimento. Alguns pedidos podem ser limitados por obrigação legal ou necessidade de preservação. Em Minha conta → Privacidade, você pode baixar seus dados e solicitar a exclusão da conta sem custo.",
  },
  {
    h: "8. Cookies, métricas e decisões automatizadas",
    p: "Cookies e armazenamento local essenciais mantêm sessão, carrinho, segurança, unidade e preferências. Métricas de desempenho/uso e monitoramento de erros operam quando habilitados no ambiente de hospedagem e seguem a configuração dos respectivos fornecedores. A loja não toma decisão com efeito jurídico ou impacto relevante exclusivamente por processamento automatizado; prevenção a fraude e roteamento podem usar regras, com revisão humana disponível pelo atendimento.",
  },
];

export default async function PrivacyPage() {
  const store = await getStoreSettings();
  const controllerReady = Boolean(
    store.legalName && store.cnpj && store.email && store.address
  );

  return (
    <div className="container-page max-w-3xl space-y-6 py-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-extrabold md:text-4xl">Política de Privacidade</h1>
        <p className="text-sm text-muted-foreground">
          Versão {PRIVACY_VERSION} · última atualização: {formatPolicyVersion(PRIVACY_VERSION)}.
          Em conformidade com a Lei Geral de Proteção de Dados (LGPD).
        </p>
      </header>
      <div className="space-y-5">
        <section className="space-y-1.5">
          <h2 className="text-lg font-bold">Controlador e canal de privacidade</h2>
          {controllerReady ? (
            <p className="text-sm leading-relaxed text-muted-foreground">
              O controlador é {store.legalName}, CNPJ {store.cnpj}, com endereço
              em {store.address}. Solicitações de titulares podem ser enviadas
              para {store.email}.
            </p>
          ) : (
            <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              Ambiente ainda não liberado: a identificação e o canal de
              privacidade do controlador precisam ser configurados antes da
              operação comercial.
            </p>
          )}
        </section>
        {sections.map((s) => (
          <section key={s.h} className="space-y-1.5">
            <h2 className="text-lg font-bold">{s.h}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{s.p}</p>
          </section>
        ))}
        <p className="text-sm leading-relaxed text-muted-foreground">
          Se uma solicitação não for atendida de forma satisfatória, o titular
          também pode consultar os canais oficiais da{" "}
          <a
            href="https://www.gov.br/anpd/pt-br/canais_atendimento/cidadao-titular-de-dados/denuncia-peticao-de-titular-referente-lgpd"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-brand-600 hover:underline dark:text-brand-400"
          >
            Autoridade Nacional de Proteção de Dados (ANPD)
          </a>.
        </p>
      </div>
    </div>
  );
}

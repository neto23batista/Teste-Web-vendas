import { formatBRL } from "@/lib/utils";

// Templates de e-mail (HTML inline — clientes de e-mail ignoram CSS externo).
// Mantidos simples e com a identidade da marca.

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function layout(title: string, body: string): string {
  return `<div style="font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f1f5f9;padding:24px">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#c81328,#f9603f);padding:20px 24px;color:#fff;font-weight:800;font-size:18px">FarmaVida</div>
    <div style="padding:24px;color:#0f172a;font-size:14px;line-height:1.6">
      <h1 style="font-size:18px;margin:0 0 12px">${title}</h1>
      ${body}
    </div>
    <div style="padding:16px 24px;color:#94a3b8;font-size:12px;border-top:1px solid #e2e8f0">
      FarmaVida · sua farmácia premium. Este é um e-mail automático.
    </div>
  </div>
</div>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:20px 0"><a href="${href}" style="background:#10b981;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:700;display:inline-block">${label}</a></p>`;
}

export function passwordResetEmail(name: string, url: string) {
  return {
    subject: "Redefinição de senha — FarmaVida",
    html: layout(
      "Redefinir sua senha",
      `<p>Olá, ${escapeHtml(name)}.</p>
       <p>Recebemos um pedido para redefinir a senha da sua conta. O link abaixo é válido por <strong>1 hora</strong>.</p>
       ${button(url, "Redefinir senha")}
       <p style="color:#64748b">Se você não solicitou, ignore este e-mail — sua senha continua a mesma.</p>`
    ),
  };
}

export function welcomeEmail(name: string, url: string) {
  return {
    subject: "Bem-vindo à FarmaVida 💚",
    html: layout(
      `Bem-vindo, ${escapeHtml(name.split(" ")[0] ?? name)}!`,
      `<p>Sua conta foi criada com sucesso. Agora você compra mais rápido, acompanha seus pedidos e acumula pontos de fidelidade.</p>
       ${button(url, "Ver produtos")}
       <p style="color:#64748b">Bons cuidados!</p>`
    ),
  };
}

export function orderReceivedEmail(
  order: { number: string; total: number },
  url: string
) {
  return {
    subject: `Recebemos seu pedido ${order.number}`,
    html: layout(
      "Pedido recebido!",
      `<p>Seu pedido <strong>${escapeHtml(order.number)}</strong> foi registrado.</p>
       <p>Total: <strong>${formatBRL(order.total)}</strong></p>
       <p>Assim que o pagamento for confirmado, começamos a preparar tudo. Você pode acompanhar o status a qualquer momento.</p>
       ${button(url, "Acompanhar pedido")}`
    ),
  };
}

// --- Avisos operacionais para a equipe da unidade ---

export function newOrderForUnitEmail(
  order: { number: string; total: number; itemsCount: number },
  url: string
) {
  return {
    subject: `Novo pedido na sua unidade — ${order.number}`,
    html: layout(
      "Novo pedido recebido",
      `<p>Um novo pedido entrou para a sua unidade e precisa de atenção.</p>
       <p>Pedido <strong>${escapeHtml(order.number)}</strong> · ${order.itemsCount} ${order.itemsCount === 1 ? "item" : "itens"}</p>
       <p>Total: <strong>${formatBRL(order.total)}</strong></p>
       ${button(url, "Abrir no painel")}`
    ),
  };
}

export function orderIncomingTransferEmail(
  order: { number: string },
  url: string
) {
  return {
    subject: `Pedido transferido para sua unidade — ${order.number}`,
    html: layout(
      "Pedido recebido por transferência",
      `<p>O pedido <strong>${escapeHtml(order.number)}</strong> foi transferido para a sua unidade e já aparece no painel.</p>
       ${button(url, "Abrir no painel")}`
    ),
  };
}

export function lowStockAlertEmail(
  items: { name: string; stock: number; minStock: number }[],
  url: string
) {
  const list = items
    .map(
      (i) =>
        `<li><strong>${escapeHtml(i.name)}</strong> — ${i.stock} un (mínimo ${i.minStock})</li>`
    )
    .join("");
  return {
    subject: `Estoque baixo: ${items.length} ${items.length === 1 ? "produto" : "produtos"} para repor`,
    html: layout(
      "Hora de repor o estoque",
      `<p>Os itens abaixo atingiram o estoque mínimo na sua unidade:</p>
       <ul style="padding-left:18px;margin:12px 0">${list}</ul>
       <p style="color:#64748b">Considere transferir de outra unidade ou comprar reposição.</p>
       ${button(url, "Ver estoque")}`
    ),
  };
}

export function subscriptionDueEmail(
  name: string,
  productName: string,
  qty: number,
  url: string
) {
  const first = name.split(" ")[0] ?? name;
  return {
    subject: `Hora de repor: ${productName}`,
    html: layout(
      "Hora de repor 💊",
      `<p>Olá, ${escapeHtml(first)}.</p>
       <p>Pela sua assinatura de reposição, está na hora de repor
       <strong>${escapeHtml(productName)}</strong>${qty > 1 ? ` (${qty} un.)` : ""}.</p>
       <p>É só confirmar — o item vai direto para a sua sacola. Você também pode
       pausar ou cancelar a assinatura quando quiser.</p>
       ${button(url, "Repor em 1 clique")}
       <p style="color:#64748b">Sem cobrança automática: nada é comprado sem a sua confirmação.</p>`
    ),
  };
}

export function orderStatusEmail(
  order: { number: string },
  statusLabel: string,
  url: string
) {
  return {
    subject: `Pedido ${order.number}: ${statusLabel}`,
    html: layout(
      "Atualização do seu pedido",
      `<p>O pedido <strong>${escapeHtml(order.number)}</strong> mudou de status para:</p>
       <p style="font-size:16px;font-weight:700;color:#10b981">${escapeHtml(statusLabel)}</p>
       ${button(url, "Ver detalhes")}`
    ),
  };
}

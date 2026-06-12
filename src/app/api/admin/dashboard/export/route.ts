import ExcelJS from "exceljs";
import { getCurrentUser } from "@/lib/session";
import {
  getAdminStats,
  getSalesByDay,
  getOrdersByStatus,
  getTopProducts,
} from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Aguardando pagamento",
  PAID: "Pago",
  PREPARING: "Em preparação",
  SHIPPED: "Enviado",
  DELIVERED: "Entregue",
  CANCELED: "Cancelado",
};

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF059669" },
};

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = HEADER_FILL;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return new Response("Acesso negado", { status: 403 });
  }

  const [stats, sales, byStatus, topProducts] = await Promise.all([
    getAdminStats(),
    getSalesByDay(30),
    getOrdersByStatus(),
    getTopProducts(10),
  ]);

  const wb = new ExcelJS.Workbook();
  wb.creator = "FarmaVida";
  wb.created = new Date();

  // ── Resumo (KPIs) ──
  const resumo = wb.addWorksheet("Resumo");
  resumo.columns = [
    { header: "Indicador", key: "k", width: 32 },
    { header: "Valor", key: "v", width: 20 },
    { header: "Variação 30d", key: "d", width: 16 },
  ];
  styleHeader(resumo.getRow(1));
  const pct = (d: number | null) => (d == null ? "—" : `${d > 0 ? "+" : ""}${d}%`);
  resumo.addRows([
    { k: "Receita total (pedidos pagos)", v: stats.revenue, d: pct(stats.deltas.revenue) },
    { k: "Pedidos", v: stats.ordersCount, d: pct(stats.deltas.orders) },
    { k: "Ticket médio", v: stats.avgTicket, d: pct(stats.deltas.avgTicket) },
    { k: "Clientes", v: stats.customersCount, d: pct(stats.deltas.customers) },
    { k: "Produtos ativos", v: stats.productsCount, d: "—" },
    { k: "Produtos com estoque baixo", v: stats.lowStock, d: "—" },
  ]);
  resumo.getCell("B2").numFmt = '"R$" #,##0.00';
  resumo.getCell("B4").numFmt = '"R$" #,##0.00';

  // ── Vendas por dia (últimos 30 dias) ──
  const vendas = wb.addWorksheet("Vendas por dia");
  vendas.columns = [
    { header: "Dia", key: "date", width: 14 },
    { header: "Vendas (R$)", key: "total", width: 16 },
  ];
  styleHeader(vendas.getRow(1));
  vendas.addRows(sales);
  vendas.getColumn("total").numFmt = '"R$" #,##0.00';

  // ── Produtos mais vendidos ──
  const top = wb.addWorksheet("Top produtos");
  top.columns = [
    { header: "Produto", key: "name", width: 44 },
    { header: "Unidades vendidas", key: "qty", width: 20 },
  ];
  styleHeader(top.getRow(1));
  top.addRows(topProducts);

  // ── Pedidos por status ──
  const status = wb.addWorksheet("Pedidos por status");
  status.columns = [
    { header: "Status", key: "status", width: 26 },
    { header: "Pedidos", key: "count", width: 14 },
  ];
  styleHeader(status.getRow(1));
  status.addRows(
    byStatus.map((s) => ({ status: STATUS_LABEL[s.status] ?? s.status, count: s.count }))
  );

  const buffer = await wb.xlsx.writeBuffer();
  const date = new Date().toISOString().slice(0, 10);

  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="dashboard-farmavida-${date}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}

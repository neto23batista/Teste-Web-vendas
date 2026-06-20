"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { formatBRL } from "@/lib/utils";
import { STATUS_META } from "@/components/store/order-status";
import type { OrderStatus } from "@prisma/client";

const BRAND = "#11b29c";
const ACCENT = "#0ea5e9";
const PALETTE = ["#11b29c", "#0ea5e9", "#8b5cf6", "#f59e0b", "#f15a3b", "#a3e635"];

export function SalesAreaChart({ data }: { data: { date: string; total: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ left: -10, right: 8, top: 8 }}>
        <defs>
          <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={BRAND} stopOpacity={0.35} />
            <stop offset="100%" stopColor={BRAND} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={48} />
        <Tooltip
          formatter={(v) => [formatBRL(Number(v)), "Vendas"]}
          contentStyle={{ borderRadius: 12, border: "1px solid rgba(148,163,184,0.3)", fontSize: 12 }}
        />
        <Area type="monotone" dataKey="total" stroke={BRAND} strokeWidth={2.5} fill="url(#salesFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function TopProductsBar({ data }: { data: { name: string; qty: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={140}
          tickFormatter={(v: string) => (v.length > 20 ? v.slice(0, 20) + "…" : v)}
        />
        <Tooltip
          formatter={(v) => [Number(v), "Unidades"]}
          contentStyle={{ borderRadius: 12, border: "1px solid rgba(148,163,184,0.3)", fontSize: 12 }}
          cursor={{ fill: "rgba(5,150,105,0.06)" }}
        />
        <Bar dataKey="qty" fill={ACCENT} radius={[0, 6, 6, 0]} barSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function StatusDonut({ data }: { data: { status: OrderStatus; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          dataKey="count"
          nameKey="status"
          innerRadius={60}
          outerRadius={95}
          paddingAngle={3}
        >
          {data.map((entry, i) => (
            <Cell key={entry.status} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(v, _n, p) => {
            const s = (p?.payload as { status?: OrderStatus })?.status;
            return [Number(v), (s && STATUS_META[s]?.label) || s || ""];
          }}
          contentStyle={{ borderRadius: 12, border: "1px solid rgba(148,163,184,0.3)", fontSize: 12 }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

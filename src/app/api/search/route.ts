import { NextResponse } from "next/server";
import { getProductSuggestions } from "@/lib/catalog";
import { rateLimit, clientIp } from "@/lib/security/rate-limit";
import { getSelectedPharmacyId } from "@/lib/pharmacy";

// Sugestões de busca (autocomplete do header). Leve e somente leitura.
export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ items: [] });

  // Endpoint público que consulta o banco a cada tecla — limita por IP para
  // conter abuso/scraping (durável via Upstash quando configurado).
  const ip = await clientIp();
  const rl = await rateLimit(`search:${ip}`, 40, 10_000);
  if (!rl.ok) {
    return NextResponse.json(
      { items: [], error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  const pharmacyId = await getSelectedPharmacyId();
  const items = await getProductSuggestions(q, 6, pharmacyId);
  return NextResponse.json({ items });
}

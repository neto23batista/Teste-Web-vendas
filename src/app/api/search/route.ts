import { NextResponse } from "next/server";
import { searchProducts } from "@/lib/products";
import { rateLimit, clientIp } from "@/lib/rate-limit";

// Sugestões de busca (autocomplete do header). Leve e somente leitura.
export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ items: [] });

  // Endpoint público que consulta o banco a cada tecla — limita por IP para
  // conter abuso/scraping. (Por instância hoje; durável quando o Redis entrar — P1 #5.)
  const ip = await clientIp();
  const rl = rateLimit(`search:${ip}`, 40, 10_000);
  if (!rl.ok) {
    return NextResponse.json(
      { items: [], error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  const { items, total } = await searchProducts({ q, perPage: 6, page: 1 });

  const suggestions = items.map((p) => ({
    name: p.name,
    slug: p.slug,
    emoji: p.emoji,
    image: p.images[0]?.url ?? null,
    price: p.promoPrice ?? p.price,
    oldPrice: p.promoPrice != null ? p.price : null,
    category: p.category.name,
  }));

  return NextResponse.json({ items: suggestions, total });
}

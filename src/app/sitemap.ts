import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

const BASE = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

// Gerado sob demanda (não no build): depende do banco, que pode não estar
// acessível durante o build na Vercel.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Resiliente: se o banco falhar, o sitemap ainda responde com as rotas fixas.
  let products: { slug: string; updatedAt: Date }[] = [];
  let categories: { slug: string }[] = [];
  try {
    [products, categories] = await Promise.all([
      prisma.product.findMany({
        where: { active: true },
        select: { slug: true, updatedAt: true },
      }),
      prisma.category.findMany({ select: { slug: true } }),
    ]);
  } catch {
    // sem banco: devolve apenas as rotas estáticas abaixo
  }

  const staticRoutes = ["", "/catalogo", "/sobre", "/privacidade", "/termos"].map(
    (path) => ({
      url: `${BASE}${path}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: path === "" ? 1 : 0.7,
    })
  );

  const categoryRoutes = categories.map((c) => ({
    url: `${BASE}/catalogo?cat=${c.slug}`,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  const productRoutes = products.map((p) => ({
    url: `${BASE}/produto/${p.slug}`,
    lastModified: p.updatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [...staticRoutes, ...categoryRoutes, ...productRoutes];
}

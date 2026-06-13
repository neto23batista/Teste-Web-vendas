import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
// Fotos reais validadas por scripts/check-product-images.cjs (name → url).
// DESATIVADAS por padrão (o dono preferiu o visual de emoji estilizado).
// Para popular com fotos: SEED_PRODUCT_PHOTOS=1 npm run db:seed
import productImages from "./product-images.json";

const prisma = new PrismaClient();

const USE_PHOTOS = process.env.SEED_PRODUCT_PHOTOS === "1";

const imageFor = (name: string): string | undefined =>
  USE_PHOTOS ? (productImages as Record<string, string>)[name] : undefined;

// ───────── Categorias ─────────
const categories = [
  { slug: "medicamentos", name: "Medicamentos", icon: "Pill", emoji: "💊", sort: 1 },
  { slug: "saude", name: "Saúde", icon: "HeartPulse", emoji: "🩺", sort: 2 },
  { slug: "dermo", name: "Dermocosméticos", icon: "Sparkles", emoji: "✨", sort: 3 },
  { slug: "bebe", name: "Mamãe & Bebê", icon: "Baby", emoji: "👶", sort: 4 },
  { slug: "vitaminas", name: "Vitaminas & Suplementos", icon: "Sun", emoji: "☀️", sort: 5 },
  { slug: "cuidados", name: "Higiene & Cuidados", icon: "Stethoscope", emoji: "🧴", sort: 6 },
  { slug: "beleza", name: "Beleza", icon: "Wand2", emoji: "💄", sort: 7 },
  { slug: "equipamentos", name: "Equipamentos", icon: "Activity", emoji: "🩹", sort: 8 },
];

const brands = [
  "Genérico", "EMS", "Medley", "Neo Química", "Eurofarma", "Cimed",
  "Hypera", "La Roche-Posay", "CeraVe", "Nivea", "Sundown", "Vitasay",
];

type Seed = {
  name: string;
  cat: string;
  brand: string;
  price: number;
  promo?: number;
  rx?: boolean;
  generic?: boolean;
  stock: number;
  emoji: string;
  short: string;
  featured?: boolean;
  rating: number;
  ratingCount: number;
};

const products: Seed[] = [
  // Medicamentos
  { name: "Dipirona Sódica 1g 10 comprimidos", cat: "medicamentos", brand: "Genérico", price: 12.9, promo: 8.99, generic: true, stock: 120, emoji: "💊", short: "Analgésico e antitérmico para dores e febre.", featured: true, rating: 4.8, ratingCount: 214 },
  { name: "Paracetamol 750mg 20 comprimidos", cat: "medicamentos", brand: "EMS", price: 18.5, promo: 13.9, generic: true, stock: 90, emoji: "💊", short: "Alívio de dores leves a moderadas e febre.", rating: 4.7, ratingCount: 167 },
  { name: "Ibuprofeno 400mg 30 cápsulas", cat: "medicamentos", brand: "Medley", price: 27.9, generic: true, stock: 75, emoji: "💊", short: "Anti-inflamatório para dores e inflamações.", rating: 4.6, ratingCount: 98 },
  { name: "Amoxicilina 500mg 21 cápsulas", cat: "medicamentos", brand: "Eurofarma", price: 34.9, rx: true, stock: 40, emoji: "💊", short: "Antibiótico — venda sob prescrição médica.", rating: 4.5, ratingCount: 41 },
  { name: "Losartana 50mg 30 comprimidos", cat: "medicamentos", brand: "Neo Química", price: 22.9, promo: 16.9, generic: true, rx: true, stock: 60, emoji: "💊", short: "Controle da pressão arterial. Uso contínuo.", featured: true, rating: 4.9, ratingCount: 305 },
  { name: "Omeprazol 20mg 28 cápsulas", cat: "medicamentos", brand: "EMS", price: 19.9, generic: true, stock: 110, emoji: "💊", short: "Protetor gástrico para azia e refluxo.", rating: 4.7, ratingCount: 188 },
  { name: "Loratadina 10mg 12 comprimidos", cat: "medicamentos", brand: "Cimed", price: 14.5, promo: 9.9, generic: true, stock: 85, emoji: "💊", short: "Antialérgico sem sonolência.", rating: 4.6, ratingCount: 73 },
  { name: "Buscopan Composto 20 comprimidos", cat: "medicamentos", brand: "Hypera", price: 29.9, stock: 50, emoji: "💊", short: "Alívio de cólicas e dores abdominais.", rating: 4.8, ratingCount: 142 },

  // Saúde
  { name: "Termômetro Digital Clínico", cat: "saude", brand: "Cimed", price: 39.9, promo: 24.9, stock: 45, emoji: "🌡️", short: "Medição rápida e precisa em 30s.", featured: true, rating: 4.7, ratingCount: 256 },
  { name: "Álcool em Gel 70% 500ml", cat: "saude", brand: "Cimed", price: 16.9, promo: 11.9, stock: 200, emoji: "🧴", short: "Higienização das mãos com hidratante.", rating: 4.8, ratingCount: 410 },
  { name: "Máscara Cirúrgica Tripla 50un", cat: "saude", brand: "Cimed", price: 24.9, stock: 150, emoji: "😷", short: "Proteção descartável com elástico.", rating: 4.5, ratingCount: 89 },
  { name: "Soro Fisiológico 0,9% 500ml", cat: "saude", brand: "EMS", price: 9.9, stock: 130, emoji: "💧", short: "Limpeza nasal e de feridas.", rating: 4.7, ratingCount: 64 },
  { name: "Oxímetro de Dedo Digital", cat: "saude", brand: "Cimed", price: 89.9, promo: 59.9, stock: 30, emoji: "🫀", short: "Mede saturação de oxigênio e pulso.", featured: true, rating: 4.6, ratingCount: 121 },

  // Dermocosméticos
  { name: "Protetor Solar Anthelios FPS 70", cat: "dermo", brand: "La Roche-Posay", price: 89.9, promo: 69.9, stock: 60, emoji: "🧴", short: "Alta proteção UVA/UVB, toque seco.", featured: true, rating: 4.9, ratingCount: 512 },
  { name: "Gel de Limpeza Facial Effaclar 150ml", cat: "dermo", brand: "La Roche-Posay", price: 79.9, stock: 55, emoji: "🧼", short: "Controle de oleosidade para pele acneica.", rating: 4.8, ratingCount: 327 },
  { name: "Hidratante Facial CeraVe 52g", cat: "dermo", brand: "CeraVe", price: 64.9, promo: 49.9, stock: 70, emoji: "✨", short: "Hidratação 24h com ácido hialurônico.", featured: true, rating: 4.9, ratingCount: 489 },
  { name: "Sérum Vitamina C 30ml", cat: "dermo", brand: "La Roche-Posay", price: 129.9, promo: 99.9, stock: 35, emoji: "🌟", short: "Antioxidante que ilumina e uniformiza.", rating: 4.7, ratingCount: 203 },

  // Mamãe & Bebê
  { name: "Fralda Premium Tamanho M 64un", cat: "bebe", brand: "Nivea", price: 79.9, promo: 59.9, stock: 80, emoji: "👶", short: "Proteção de até 12h, antivazamento.", featured: true, rating: 4.8, ratingCount: 298 },
  { name: "Lenço Umedecido 96un", cat: "bebe", brand: "Nivea", price: 18.9, promo: 12.9, stock: 140, emoji: "🧷", short: "Limpeza suave com aloe vera.", rating: 4.7, ratingCount: 176 },
  { name: "Pomada para Assaduras 45g", cat: "bebe", brand: "Cimed", price: 22.9, stock: 90, emoji: "🍼", short: "Previne e trata assaduras.", rating: 4.6, ratingCount: 84 },
  { name: "Shampoo Infantil Sem Lágrimas 200ml", cat: "bebe", brand: "Nivea", price: 16.9, stock: 100, emoji: "🧴", short: "Fórmula suave que não arde os olhos.", rating: 4.8, ratingCount: 132 },

  // Vitaminas
  { name: "Vitamina C 1g 30 comprimidos", cat: "vitaminas", brand: "Sundown", price: 39.9, promo: 27.9, stock: 110, emoji: "🍊", short: "Reforço da imunidade no dia a dia.", featured: true, rating: 4.8, ratingCount: 364 },
  { name: "Vitamina D3 2000UI 60 cápsulas", cat: "vitaminas", brand: "Vitasay", price: 49.9, promo: 34.9, stock: 95, emoji: "☀️", short: "Saúde óssea e imunológica.", featured: true, rating: 4.9, ratingCount: 421 },
  { name: "Ômega 3 1000mg 120 cápsulas", cat: "vitaminas", brand: "Sundown", price: 69.9, promo: 49.9, stock: 70, emoji: "🐟", short: "Saúde cardiovascular e cerebral.", rating: 4.7, ratingCount: 245 },
  { name: "Magnésio Quelato 60 cápsulas", cat: "vitaminas", brand: "Vitasay", price: 44.9, stock: 85, emoji: "💪", short: "Energia e função muscular.", rating: 4.6, ratingCount: 118 },
  { name: "Multivitamínico A-Z 60 comprimidos", cat: "vitaminas", brand: "Sundown", price: 54.9, promo: 39.9, stock: 100, emoji: "🌈", short: "Complexo completo para o dia a dia.", rating: 4.7, ratingCount: 209 },
  { name: "Colágeno Hidrolisado + Vit C 300g", cat: "vitaminas", brand: "Vitasay", price: 89.9, promo: 64.9, stock: 60, emoji: "💧", short: "Firmeza da pele e articulações.", rating: 4.5, ratingCount: 97 },

  // Higiene & Cuidados
  { name: "Creme Dental Branqueador 90g", cat: "cuidados", brand: "Nivea", price: 9.9, stock: 180, emoji: "🪥", short: "Limpeza profunda e hálito fresco.", rating: 4.6, ratingCount: 73 },
  { name: "Enxaguante Bucal Sem Álcool 500ml", cat: "cuidados", brand: "Cimed", price: 19.9, promo: 13.9, stock: 120, emoji: "🦷", short: "Proteção antibacteriana 12h.", rating: 4.7, ratingCount: 88 },
  { name: "Desodorante Roll-on 48h 50ml", cat: "cuidados", brand: "Nivea", price: 14.9, stock: 160, emoji: "🧴", short: "Proteção prolongada sem manchas.", rating: 4.6, ratingCount: 64 },
  { name: "Sabonete Líquido Antibacteriano 250ml", cat: "cuidados", brand: "Nivea", price: 17.9, promo: 12.9, stock: 140, emoji: "🧼", short: "Limpa e protege a pele.", rating: 4.5, ratingCount: 51 },

  // Beleza
  { name: "Batom Matte Longa Duração", cat: "beleza", brand: "Nivea", price: 34.9, promo: 24.9, stock: 75, emoji: "💄", short: "Cor intensa por até 8h.", rating: 4.6, ratingCount: 142 },
  { name: "Base Líquida HD 30ml", cat: "beleza", brand: "Nivea", price: 59.9, stock: 50, emoji: "💋", short: "Cobertura natural e uniforme.", rating: 4.5, ratingCount: 96 },
  { name: "Máscara de Cílios Volume", cat: "beleza", brand: "Nivea", price: 39.9, promo: 29.9, stock: 65, emoji: "👁️", short: "Volume e alongamento à prova d'água.", rating: 4.7, ratingCount: 118 },

  // Equipamentos
  { name: "Aparelho de Pressão Digital de Braço", cat: "equipamentos", brand: "Cimed", price: 199.9, promo: 149.9, stock: 25, emoji: "🩺", short: "Medição automática com memória.", featured: true, rating: 4.8, ratingCount: 187 },
  { name: "Nebulizador Inalador Compacto", cat: "equipamentos", brand: "Cimed", price: 169.9, promo: 119.9, stock: 30, emoji: "💨", short: "Silencioso, ideal para toda a família.", rating: 4.7, ratingCount: 134 },
  { name: "Glicosímetro + 50 tiras", cat: "equipamentos", brand: "Cimed", price: 129.9, promo: 89.9, stock: 40, emoji: "🩸", short: "Monitoramento de glicose rápido.", rating: 4.6, ratingCount: 112 },
  { name: "Balança Digital Corporal", cat: "equipamentos", brand: "Cimed", price: 89.9, promo: 59.9, stock: 55, emoji: "⚖️", short: "Precisão de até 180kg, vidro temperado.", rating: 4.5, ratingCount: 78 },
];

function descFor(p: Seed): string {
  return [
    p.short,
    `Produto da linha ${p.brand}, com qualidade garantida e procedência segura.`,
    p.rx
      ? "Este item exige receita médica — envie o documento no checkout para validação farmacêutica."
      : "Disponível para compra imediata, com entrega rápida e atendimento farmacêutico.",
    "Leia a bula e mantenha fora do alcance de crianças.",
  ].join(" ");
}

function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function main() {
  console.log("🌱 Limpando dados...");
  await prisma.review.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.prescription.deleteMany();
  await prisma.loyaltyTransaction.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.product.deleteMany();
  await prisma.brand.deleteMany();
  await prisma.category.deleteMany();
  await prisma.coupon.deleteMany();
  await prisma.loyaltyAccount.deleteMany();
  await prisma.address.deleteMany();
  await prisma.user.deleteMany();
  await prisma.setting.deleteMany();

  console.log("👤 Usuários...");
  const admin = await prisma.user.create({
    data: {
      name: "Dono FarmaVida",
      email: "owner@farmavida.local",
      passwordHash: await bcrypt.hash("Dono@Farma2026", 10),
      role: "ADMIN",
    },
  });
  const customer = await prisma.user.create({
    data: {
      name: "Cliente Demo",
      email: "cliente@farmavida.local",
      passwordHash: await bcrypt.hash("Cliente@2026", 10),
      role: "CUSTOMER",
      cpf: "529.982.247-25",
      phone: "(11) 90000-0000",
      loyalty: { create: { points: 320 } },
      addresses: {
        create: {
          label: "Casa",
          recipient: "Cliente Demo",
          zip: "01310-100",
          street: "Av. Paulista",
          number: "1000",
          district: "Bela Vista",
          city: "São Paulo",
          state: "SP",
          isDefault: true,
        },
      },
    },
  });

  console.log("🏷️  Categorias e marcas...");
  const catMap = new Map<string, string>();
  for (const c of categories) {
    const created = await prisma.category.create({ data: c });
    catMap.set(c.slug, created.id);
  }
  const brandMap = new Map<string, string>();
  for (const name of brands) {
    const created = await prisma.brand.create({
      data: { name, slug: slugify(name) },
    });
    brandMap.set(name, created.id);
  }

  console.log("📦 Produtos...");
  const seen = new Set<string>();
  for (const p of products) {
    let slug = slugify(p.name);
    while (seen.has(slug)) slug = `${slug}-x`;
    seen.add(slug);
    const imageUrl = imageFor(p.name);
    await prisma.product.create({
      data: {
        name: p.name,
        slug,
        description: descFor(p),
        shortDescription: p.short,
        emoji: p.emoji,
        price: p.price,
        promoPrice: p.promo ?? null,
        requiresPrescription: p.rx ?? false,
        isGeneric: p.generic ?? false,
        stock: p.stock,
        rating: p.rating,
        ratingCount: p.ratingCount,
        featured: p.featured ?? false,
        categoryId: catMap.get(p.cat)!,
        brandId: brandMap.get(p.brand) ?? null,
        ...(imageUrl
          ? { images: { create: [{ url: imageUrl, alt: p.name, sort: 0 }] } }
          : {}),
      },
    });
  }

  console.log("🎟️  Cupom, avaliações e configurações...");
  await prisma.coupon.create({
    data: { code: "BEMVINDO10", type: "PERCENT", value: 10, minTotal: 50, active: true },
  });

  const firstProducts = await prisma.product.findMany({ take: 3 });
  for (const fp of firstProducts) {
    await prisma.review.create({
      data: {
        productId: fp.id,
        userId: customer.id,
        rating: 5,
        comment: "Entrega rápida e produto excelente. Recomendo!",
        approved: true, // demo já moderada (novas avaliações nascem pendentes)
      },
    });
  }

  await prisma.setting.createMany({
    data: [
      { key: "pharmacy_name", value: "FarmaVida" },
      { key: "pharmacy_cnpj", value: "12.345.678/0001-90" },
      { key: "pharmacist", value: "Dra. Ana Souza - CRF/SP 123456" },
      { key: "free_shipping_min", value: "150" },
      { key: "shipping_flat", value: "14.90" },
    ],
  });

  const total = await prisma.product.count();
  console.log(`✅ Seed concluído: ${total} produtos, admin=${admin.email}, cliente=${customer.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

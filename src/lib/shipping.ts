// Preço padrão quando não há configuração (grátis local; ver ShippingConfig).
export const FREE_SHIPPING_MIN = 10; // grátis a partir de R$ 10 (frete padrão)
export const FREE_RADIUS_KM = 4; // até 4 km sem custo no frete padrão
export const PER_KM = 1; // R$ 1,00 por km (excedente no padrão / por km na rápida)
export const EXPRESS_FLAT = 5; // taxa fixa da Entrega Rápida (R$)

export type DeliveryMethod = "standard" | "express";

/** Parâmetros de frete configuráveis pelo dono em /admin/configuracoes.
 *  Este módulo roda também no client (checkout), então recebe a config por
 *  parâmetro — quem busca no banco é src/lib/settings.ts (server). A distância
 *  (km) vem das faixas de CEP da unidade (PharmacyCepRange.km). */
export type ShippingConfig = {
  /** Frete padrão grátis a partir deste subtotal (R$). */
  freeMin: number;
  /** Raio (km) coberto sem custo no frete padrão, quando atinge o mínimo. */
  freeRadiusKm: number;
  /** R$ por km — excedente no frete padrão e por km na Entrega Rápida. */
  perKm: number;
  /** Taxa fixa da Entrega Rápida (R$), somada ao custo por km. */
  expressFlat: number;
  /** km assumido quando o CEP não casa nenhuma faixa cadastrada. */
  defaultKm: number;
};

export const DEFAULT_SHIPPING_CONFIG: ShippingConfig = {
  freeMin: FREE_SHIPPING_MIN,
  freeRadiusKm: FREE_RADIUS_KM,
  perKm: PER_KM,
  expressFlat: EXPRESS_FLAT,
  defaultKm: 0,
};

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Frete pela modalidade escolhida e distância (km) até o destino.
 *
 * - **Padrão**: grátis a partir de `freeMin` em entregas de até `freeRadiusKm`;
 *   além do raio, `perKm` por km excedente. Abaixo do mínimo, cobra `perKm` por
 *   km desde o km 0 (não há raio grátis).
 * - **Rápida (30–40 min)**: `expressFlat` fixo + `perKm` por km percorrido
 *   (sempre cobrada — é um serviço premium).
 */
export function shippingFor(
  subtotal: number,
  km: number | null | undefined,
  method: DeliveryMethod = "standard",
  config: ShippingConfig = DEFAULT_SHIPPING_CONFIG
): number {
  const dist = Math.max(0, km ?? config.defaultKm);

  if (method === "express") {
    return round(config.expressFlat + config.perKm * dist);
  }

  if (subtotal <= 0) return 0;
  const freeKm = subtotal >= config.freeMin ? config.freeRadiusKm : 0;
  const excess = Math.max(0, dist - freeKm);
  return round(config.perKm * excess);
}

export function missingForFreeShipping(
  subtotal: number,
  config: ShippingConfig = DEFAULT_SHIPPING_CONFIG
): number {
  return Math.max(0, config.freeMin - subtotal);
}

export type DeliveryOption = {
  method: DeliveryMethod;
  label: string;
  eta: string;
  price: number;
};

/** As duas modalidades com preço já calculado, para o seletor do checkout. */
export function deliveryOptions(
  subtotal: number,
  km: number | null | undefined,
  config: ShippingConfig = DEFAULT_SHIPPING_CONFIG
): DeliveryOption[] {
  return [
    {
      method: "standard",
      label: "Entrega padrão",
      eta: "Chega hoje",
      price: shippingFor(subtotal, km, "standard", config),
    },
    {
      method: "express",
      label: "Entrega Rápida",
      eta: "30–40 min",
      price: shippingFor(subtotal, km, "express", config),
    },
  ];
}

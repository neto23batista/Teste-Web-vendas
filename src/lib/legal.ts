/** Versões imutáveis exibidas e registradas quando o usuário aceita as políticas. */
export const TERMS_VERSION = "2026-08-22";
export const PRIVACY_VERSION = "2026-08-22";

export function formatPolicyVersion(version: string): string {
  const [year, month, day] = version.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, day))
  );
}

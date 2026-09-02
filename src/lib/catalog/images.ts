export const PRODUCT_IMAGE_HOSTS = [
  "images.unsplash.com",
  "images.pexels.com",
] as const;

const ALLOWED = new Set<string>(PRODUCT_IMAGE_HOSTS);

export function validateProductImageUrls(raw: string):
  | { ok: true; urls: string[] }
  | { ok: false; error: string } {
  const entries = raw
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (entries.length > 8) {
    return { ok: false, error: "Informe no máximo 8 imagens." };
  }

  const urls: string[] = [];
  for (const entry of entries) {
    let url: URL;
    try {
      url = new URL(entry);
    } catch {
      return { ok: false, error: `URL de imagem inválida: ${entry}` };
    }
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      !ALLOWED.has(url.hostname.toLowerCase())
    ) {
      return {
        ok: false,
        error: `Imagem não permitida. Use HTTPS em: ${PRODUCT_IMAGE_HOSTS.join(", ")}.`,
      };
    }
    const normalized = url.toString();
    if (!urls.includes(normalized)) urls.push(normalized);
  }
  return { ok: true, urls };
}

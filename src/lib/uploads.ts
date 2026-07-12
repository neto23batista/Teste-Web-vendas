import { randomUUID } from "crypto";
import { putObject } from "@/lib/storage";

// Tipos aceitos (receitas): PDF e imagens comuns. Extensão derivada do MIME
// (nunca do nome do arquivo enviado).
const ALLOWED: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Descobre o tipo pelos BYTES do arquivo (assinatura/"magic number"), não pelo
 * Content-Type — que vem do navegador e pode mentir. Sem isso, um HTML/script
 * poderia ser gravado como "image/png".
 */
function sniffMime(b: Buffer): string | null {
  if (b.length >= 4 && b.toString("ascii", 0, 4) === "%PDF") {
    return "application/pdf";
  }
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    b.length >= 8 &&
    b.toString("hex", 0, 8) === "89504e470d0a1a0a"
  ) {
    return "image/png";
  }
  if (
    b.length >= 12 &&
    b.toString("ascii", 0, 4) === "RIFF" &&
    b.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export type UploadResult =
  | { ok: true; key: string }
  | { ok: false; error: string };

/**
 * Valida e salva um arquivo enviado num storage PRIVADO.
 * Retorna a CHAVE do objeto (não uma URL pública) — o acesso é mediado por
 * rota autenticada (ex.: /api/prescriptions/[id]).
 */
export async function saveUpload(
  file: File,
  subdir: string
): Promise<UploadResult> {
  const ext = ALLOWED[file.type];
  if (!ext) {
    return { ok: false, error: "Formato inválido. Envie PDF, JPG, PNG ou WEBP." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "Arquivo muito grande (máximo 5 MB)." };
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  // O conteúdo real precisa bater com o tipo declarado.
  if (sniffMime(bytes) !== file.type) {
    return {
      ok: false,
      error: "Arquivo corrompido ou fora do formato. Envie PDF, JPG, PNG ou WEBP.",
    };
  }

  const key = `${subdir}/${Date.now()}-${randomUUID()}.${ext}`;
  try {
    await putObject(key, bytes);
  } catch (err) {
    // Storage indisponível/mal configurado (ex.: driver "local" na Vercel, que
    // tem FS efêmero/somente-leitura). Falha com mensagem amigável em vez de
    // derrubar o checkout. Configure STORAGE_DRIVER=s3 + S3_* (R2) em produção.
    console.error("[uploads] falha ao salvar no storage:", err);
    return {
      ok: false,
      error: "Não foi possível salvar o arquivo agora. Tente novamente em instantes.",
    };
  }
  return { ok: true, key };
}

// Mapeia a extensão da chave de volta para o Content-Type ao servir o arquivo.
export const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

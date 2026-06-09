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

  const key = `${subdir}/${Date.now()}-${randomUUID()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  await putObject(key, bytes);
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

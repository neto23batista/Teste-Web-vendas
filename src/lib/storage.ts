import { writeFile, mkdir, readFile } from "fs/promises";
import path from "path";

/**
 * Adapter de armazenamento de arquivos privados (ex.: receitas).
 *
 * Driver escolhido por env (`STORAGE_DRIVER`, ou "s3" automático se `S3_BUCKET`):
 *  - "local" (default): disco FORA de `public/` (não servido estaticamente).
 *    Bom p/ VPS/Docker com volume persistente; NÃO use em serverless (FS efêmero).
 *  - "s3": S3 ou compatível (Cloudflare R2, MinIO, DO Spaces) via `S3_*`.
 *
 * Interface estável (putObject/getObject) — o resto do app não conhece o driver.
 * As chaves são aleatórias (ver uploads.ts) e o driver local bloqueia path traversal.
 */
const DRIVER =
  process.env.STORAGE_DRIVER?.toLowerCase() ||
  (process.env.S3_BUCKET ? "s3" : "local");

// ───────────────────────── Local (disco) ─────────────────────────
const ROOT = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(process.cwd(), "private-uploads");

function resolveKey(key: string): string {
  const full = path.resolve(ROOT, key);
  if (full !== ROOT && !full.startsWith(ROOT + path.sep)) {
    throw new Error("Chave de arquivo inválida");
  }
  return full;
}

async function localPut(key: string, data: Buffer): Promise<void> {
  const full = resolveKey(key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, data);
}

async function localGet(key: string): Promise<Buffer> {
  return readFile(resolveKey(key));
}

// ───────────────────────── S3 / compatível (lazy) ─────────────────────────
const S3_PREFIX = process.env.S3_PREFIX ?? "";

// Cliente instanciado sob demanda (e só quando o driver é s3), para não
// carregar o SDK da AWS quando se usa o disco local.
let s3Singleton: Promise<{
  client: import("@aws-sdk/client-s3").S3Client;
  bucket: string;
}> | null = null;

function s3() {
  if (!s3Singleton) {
    s3Singleton = (async () => {
      const { S3Client } = await import("@aws-sdk/client-s3");
      const hasKeys =
        process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY;
      const client = new S3Client({
        region: process.env.S3_REGION || "us-east-1",
        endpoint: process.env.S3_ENDPOINT || undefined,
        // Path-style é necessário em MinIO/R2/endpoints customizados.
        forcePathStyle: Boolean(process.env.S3_ENDPOINT),
        credentials: hasKeys
          ? {
              accessKeyId: process.env.S3_ACCESS_KEY_ID!,
              secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
            }
          : undefined, // sem chaves → cadeia padrão (IAM role/instance profile)
      });
      return { client, bucket: process.env.S3_BUCKET! };
    })();
  }
  return s3Singleton;
}

async function s3Put(key: string, data: Buffer): Promise<void> {
  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  const { client, bucket } = await s3();
  await client.send(
    new PutObjectCommand({ Bucket: bucket, Key: S3_PREFIX + key, Body: data })
  );
}

async function s3Get(key: string): Promise<Buffer> {
  const { GetObjectCommand } = await import("@aws-sdk/client-s3");
  const { client, bucket } = await s3();
  const res = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: S3_PREFIX + key })
  );
  if (!res.Body) throw new Error("Objeto vazio");
  const bytes = await res.Body.transformToByteArray();
  return Buffer.from(bytes);
}

// ───────────────────────── Interface pública ─────────────────────────
export async function putObject(key: string, data: Buffer): Promise<void> {
  return DRIVER === "s3" ? s3Put(key, data) : localPut(key, data);
}

export async function getObject(key: string): Promise<Buffer> {
  return DRIVER === "s3" ? s3Get(key) : localGet(key);
}

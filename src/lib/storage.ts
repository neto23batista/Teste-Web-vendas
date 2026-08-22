import { writeFile, mkdir, readFile, unlink } from "fs/promises";
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
type StorageDriver = "local" | "s3";

function storageDriver(): StorageDriver {
  const configured = process.env.STORAGE_DRIVER?.trim().toLowerCase();
  if (configured && configured !== "local" && configured !== "s3") {
    throw new Error("STORAGE_DRIVER deve ser 'local' ou 's3'");
  }
  const live =
    process.env.VERCEL_ENV === "production" ||
    process.env.APP_ENV === "production";
  if (live && !configured) {
    throw new Error("STORAGE_DRIVER explícito é obrigatório em produção");
  }
  if (process.env.VERCEL_ENV === "production" && configured === "local") {
    throw new Error("Storage local não é persistente na Vercel");
  }
  return (configured || (process.env.S3_BUCKET ? "s3" : "local")) as StorageDriver;
}

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

async function localDelete(key: string): Promise<void> {
  try {
    await unlink(resolveKey(key));
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code !== "ENOENT") throw cause;
  }
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
      const bucket = process.env.S3_BUCKET?.trim();
      if (!bucket) throw new Error("S3_BUCKET não configurado");
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
      return { client, bucket };
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

async function s3Delete(key: string): Promise<void> {
  const {
    DeleteObjectCommand,
    DeleteObjectsCommand,
    ListObjectVersionsCommand,
  } = await import("@aws-sdk/client-s3");
  const { client, bucket } = await s3();

  // DeleteObject sozinho cria apenas um delete marker em buckets versionados.
  // Lista e remove todas as versões/markers da chave exata para que uma receita
  // apagada por solicitação do titular não continue recuperável pelo version ID.
  const fullKey = S3_PREFIX + key;
  let keyMarker: string | undefined;
  let versionIdMarker: string | undefined;
  do {
    const listed = await client.send(
      new ListObjectVersionsCommand({
        Bucket: bucket,
        Prefix: fullKey,
        KeyMarker: keyMarker,
        VersionIdMarker: versionIdMarker,
      })
    );
    const objects = [...(listed.Versions ?? []), ...(listed.DeleteMarkers ?? [])]
      .filter((item) => item.Key === fullKey && item.VersionId)
      .map((item) => ({ Key: fullKey, VersionId: item.VersionId }));
    for (let start = 0; start < objects.length; start += 1_000) {
      const batch = objects.slice(start, start + 1_000);
      const deleted = await client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: batch, Quiet: true },
        })
      );
      if (deleted.Errors?.length) {
        throw new Error("Falha ao remover versões do objeto privado");
      }
    }
    keyMarker = listed.IsTruncated ? listed.NextKeyMarker : undefined;
    versionIdMarker = listed.IsTruncated
      ? listed.NextVersionIdMarker
      : undefined;
  } while (keyMarker);

  // Também cobre buckets sem versionamento e a janela entre o último list e o
  // delete. A operação é idempotente quando a chave já não existe.
  await client.send(
    new DeleteObjectCommand({ Bucket: bucket, Key: fullKey })
  );
}

// ───────────────────────── Interface pública ─────────────────────────
export async function putObject(key: string, data: Buffer): Promise<void> {
  return storageDriver() === "s3" ? s3Put(key, data) : localPut(key, data);
}

export async function getObject(key: string): Promise<Buffer> {
  return storageDriver() === "s3" ? s3Get(key) : localGet(key);
}

/** Exclusão idempotente: objeto ausente já satisfaz o resultado desejado. */
export async function deleteObject(key: string): Promise<void> {
  return storageDriver() === "s3" ? s3Delete(key) : localDelete(key);
}

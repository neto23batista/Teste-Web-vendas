// Autoteste do storage de uploads (receitas): grava e lê de volta um objeto
// usando o driver REAL configurado pelas env vars (local ou s3/R2).
// Uso: npx tsx scripts/test-storage.ts
import "dotenv/config";
import { putObject, getObject } from "../src/lib/storage";

(async () => {
  const driver =
    process.env.STORAGE_DRIVER?.toLowerCase() ||
    (process.env.S3_BUCKET ? "s3" : "local");
  const key = `_selftest/${Date.now()}.txt`;
  const payload = Buffer.from("farmavida storage self-test " + new Date().toISOString());

  console.log(`Driver: ${driver}${process.env.S3_ENDPOINT ? ` (endpoint: ${process.env.S3_ENDPOINT})` : ""}`);
  console.log(`Gravando objeto de teste: ${key} ...`);
  await putObject(key, payload);
  console.log("Lendo de volta ...");
  const got = await getObject(key);

  if (Buffer.compare(got, payload) === 0) {
    console.log("\n✅ STORAGE OK — gravou e leu o mesmo conteúdo. Upload de receitas vai funcionar.");
    process.exit(0);
  } else {
    console.log("\n❌ Conteúdo lido difere do gravado.");
    process.exit(1);
  }
})().catch((e) => {
  console.error("\n❌ STORAGE FALHOU:", e?.message ?? e);
  console.error("   Confira STORAGE_DRIVER=s3 e as variáveis S3_* (bucket, endpoint, chaves).");
  process.exit(1);
});

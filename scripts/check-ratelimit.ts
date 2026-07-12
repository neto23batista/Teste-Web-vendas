/**
 * Confere se o rate-limit durável (Upstash Redis) está realmente ligado.
 *
 *   npm run check:ratelimit
 *
 * Não basta a variável existir: o script faz chamadas de verdade contra o Redis
 * e checa se o limite BLOQUEIA na hora certa. Sem Redis, o limite é por
 * instância (fraco na Vercel) — é exatamente isso que queremos descobrir aqui.
 */
import { rateLimit, rateLimitIsDurable } from "../src/lib/rate-limit";

const ok = (s: string) => console.log(`  \x1b[32mOK\x1b[0m   ${s}`);
const bad = (s: string) => console.log(`  \x1b[31mFALHA\x1b[0m ${s}`);
const info = (s: string) => console.log(`       ${s}`);

async function main() {
  console.log("\nVerificando o rate-limit (proteção contra força bruta)\n");

  const durable = rateLimitIsDurable();
  const via = process.env.UPSTASH_REDIS_REST_URL
    ? "UPSTASH_REDIS_REST_* (console do Upstash)"
    : process.env.KV_REST_API_URL
      ? "KV_REST_API_* (integração da Vercel)"
      : null;

  if (!durable) {
    bad("Nenhuma credencial de Redis encontrada.");
    info("O limite está em MEMÓRIA: na Vercel isso é por instância e some no");
    info("cold start — dá para tentar senha em massa trocando de instância.");
    info("Defina UPSTASH_REDIS_REST_URL + _TOKEN (ou KV_REST_API_URL + _TOKEN).");
    process.exit(1);
  }
  ok(`Credenciais encontradas via ${via}.`);

  // Chave única por execução para não interferir em limites reais nem entre runs.
  const key = `selftest:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  const LIMIT = 3;
  const WINDOW = 10_000;

  const results: boolean[] = [];
  for (let i = 0; i < LIMIT + 1; i++) {
    const r = await rateLimit(key, LIMIT, WINDOW);
    results.push(r.ok);
  }

  const liberados = results.filter(Boolean).length;
  if (liberados !== LIMIT || results[LIMIT] !== false) {
    bad(`O limite não bloqueou como esperado (liberou ${liberados} de ${LIMIT}).`);
    info("Se o Redis falhar, o código cai no contador em memória (fail-open).");
    info("Confira se a URL/token estão corretos e se o banco está ativo.");
    process.exit(1);
  }
  ok(`Limite aplicado: liberou ${LIMIT} tentativas e BLOQUEOU a ${LIMIT + 1}ª.`);

  // Prova que o contador é COMPARTILHADO (durável), não da memória do processo:
  // uma chave nova em outra "instância lógica" respeita o mesmo contador remoto.
  const again = await rateLimit(key, LIMIT, WINDOW);
  if (again.ok) {
    bad("O contador não persistiu — parece estar em memória, não no Redis.");
    process.exit(1);
  }
  ok(`Contador persistido no Redis (bloqueio segue de pé, libera em ${again.retryAfter}s).`);

  console.log("\n\x1b[32mTudo certo:\x1b[0m o rate-limit durável está ativo.\n");
}

main().catch((err) => {
  bad("Erro ao falar com o Redis:");
  console.error(err);
  process.exit(1);
});

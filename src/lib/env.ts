import { z } from "zod";

// Variáveis obrigatórias para o servidor subir. Validadas no boot
// (src/instrumentation.ts) — falha cedo e com mensagem clara.
const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatória"),
  AUTH_SECRET: z.string().min(1, "AUTH_SECRET é obrigatória"),
});

export function assertEnv(): void {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `- ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Configuração de ambiente inválida:\n${issues}`);
  }

  // Em produção, recomendações (não bloqueiam o boot, mas avisam).
  if (process.env.NODE_ENV === "production") {
    const warn: string[] = [];
    if (!process.env.NEXT_PUBLIC_BASE_URL?.startsWith("https://")) {
      warn.push("NEXT_PUBLIC_BASE_URL deveria usar https://");
    }
    if (!process.env.PAGBANK_TOKEN) {
      warn.push("PAGBANK_TOKEN ausente (pagamentos online desativados)");
    }
    if (!process.env.RESEND_API_KEY || !process.env.MAIL_FROM) {
      warn.push("RESEND_API_KEY/MAIL_FROM ausentes (e-mails transacionais desativados)");
    }
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      warn.push("UPSTASH_REDIS_REST_* ausentes (rate-limit só por instância — fraco em serverless)");
    }
    if (!process.env.CRON_SECRET) {
      warn.push("CRON_SECRET ausente (cron de assinaturas desativado em produção)");
    }
    if (warn.length) {
      console.warn("[env] avisos de produção:\n" + warn.map((w) => `- ${w}`).join("\n"));
    }
  }
}

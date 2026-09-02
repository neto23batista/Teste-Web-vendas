import { afterEach, describe, expect, it, vi } from "vitest";
import { assertEnv } from "@/lib/env";

const validSecret = "aB3!dE6@hI9#kL2$mN5%pQ8&rS1*tU4(vW7)xY0-zC6_";
const validMfaEncryption = "MfaEnc-A1!b2@C3#d4$E5%f6&G7*h8(I9)j0-K1_l2";
const validMfaPepper = "MfaPep-Z9!y8@X7#w6$V5%u4&T3*s2(R1)q0-P9_o8";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("assertEnv", () => {
  it("rejeita segredo curto ou placeholder", () => {
    vi.stubEnv("DATABASE_URL", "postgresql://localhost/test");
    vi.stubEnv("AUTH_SECRET", "troque-por-um-segredo-aleatorio-123456789");
    expect(() => assertEnv()).toThrow(/placeholder/);
  });

  it("rejeita segredo longo, mas sem diversidade", () => {
    vi.stubEnv("DATABASE_URL", "postgresql://localhost/test");
    vi.stubEnv("AUTH_SECRET", "f".repeat(64));
    expect(() => assertEnv()).toThrow(/baixa diversidade/);
  });

  it("falha fechado em produção sem controles essenciais", () => {
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("DATABASE_URL", "postgresql://localhost/test");
    vi.stubEnv("AUTH_SECRET", validSecret);
    vi.stubEnv("MFA_ENCRYPTION_KEY", validMfaEncryption);
    vi.stubEnv("MFA_RECOVERY_PEPPER", validMfaPepper);
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "http://example.test");
    expect(() => assertEnv()).toThrow(/Configuração de produção insegura/);
  });

  it("não confunde build ou homologação com produção pública", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ENV", "staging");
    vi.stubEnv("DATABASE_URL", "postgresql://localhost/test");
    vi.stubEnv("AUTH_SECRET", validSecret);
    expect(() => assertEnv()).not.toThrow();
  });

  it("aceita produção com controles essenciais e TLS", () => {
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv(
      "DATABASE_URL",
      "postgresql://user:pass@db.example.test/store?sslmode=require"
    );
    vi.stubEnv("AUTH_SECRET", validSecret);
    vi.stubEnv("MFA_ENCRYPTION_KEY", validMfaEncryption);
    vi.stubEnv("MFA_RECOVERY_PEPPER", validMfaPepper);
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://loja.example.test");
    vi.stubEnv("PAYMENTS_ENABLED", "true");
    vi.stubEnv("STRIPE_SECRET_KEY", `sk_live_${"a".repeat(24)}`);
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", `whsec_${"b".repeat(24)}`);
    vi.stubEnv("EMAIL_ENABLED", "true");
    vi.stubEnv("RESEND_API_KEY", "re_test_value");
    vi.stubEnv("MAIL_FROM", "Loja <noreply@example.test>");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example.test");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "redis-token-with-entropy-123");
    vi.stubEnv("CRON_SECRET", validSecret);
    vi.stubEnv("STORAGE_DRIVER", "s3");
    vi.stubEnv("S3_BUCKET", "private-prescriptions");
    expect(() => assertEnv()).not.toThrow();
  });

  it("aceita integrações externas explicitamente desativadas", () => {
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv(
      "DATABASE_URL",
      "postgresql://user:pass@db.example.test/store?sslmode=require"
    );
    vi.stubEnv("AUTH_SECRET", validSecret);
    vi.stubEnv("MFA_ENCRYPTION_KEY", validMfaEncryption);
    vi.stubEnv("MFA_RECOVERY_PEPPER", validMfaPepper);
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://loja.example.test");
    vi.stubEnv("PAYMENTS_ENABLED", "false");
    vi.stubEnv("EMAIL_ENABLED", "false");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example.test");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "redis-token-with-entropy-123");
    vi.stubEnv("CRON_SECRET", validSecret);
    vi.stubEnv("STORAGE_DRIVER", "disabled");
    expect(() => assertEnv()).not.toThrow();
  });

  it("exige segredos MFA dedicados na loja pública", () => {
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv(
      "DATABASE_URL",
      "postgresql://user:pass@db.example.test/store?sslmode=require"
    );
    vi.stubEnv("AUTH_SECRET", validSecret);
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://loja.example.test");
    vi.stubEnv("STRIPE_SECRET_KEY", `sk_live_${"a".repeat(24)}`);
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", `whsec_${"b".repeat(24)}`);
    vi.stubEnv("RESEND_API_KEY", "re_test_value");
    vi.stubEnv("MAIL_FROM", "Loja <noreply@example.test>");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example.test");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "redis-token-with-entropy-123");
    vi.stubEnv("CRON_SECRET", validSecret);

    expect(() => assertEnv()).toThrow(/MFA_ENCRYPTION_KEY/);
    vi.stubEnv("MFA_ENCRYPTION_KEY", validMfaEncryption);
    expect(() => assertEnv()).toThrow(/MFA_RECOVERY_PEPPER/);
  });

  it("aceita REDIS_URL TCP válida e rejeita URL durável malformada", () => {
    const live = () => {
      vi.stubEnv("APP_ENV", "production");
      vi.stubEnv(
        "DATABASE_URL",
        "postgresql://user:pass@db.example.test/store?sslmode=require"
      );
      vi.stubEnv("AUTH_SECRET", validSecret);
      vi.stubEnv("MFA_ENCRYPTION_KEY", validMfaEncryption);
      vi.stubEnv("MFA_RECOVERY_PEPPER", validMfaPepper);
      vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://loja.example.test");
      vi.stubEnv("PAYMENTS_ENABLED", "true");
      vi.stubEnv("STRIPE_SECRET_KEY", `sk_live_${"a".repeat(24)}`);
      vi.stubEnv("STRIPE_WEBHOOK_SECRET", `whsec_${"b".repeat(24)}`);
      vi.stubEnv("EMAIL_ENABLED", "true");
      vi.stubEnv("RESEND_API_KEY", "re_test_value");
      vi.stubEnv("MAIL_FROM", "Loja <noreply@example.test>");
      vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
      vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
      vi.stubEnv("KV_REST_API_URL", "");
      vi.stubEnv("KV_REST_API_TOKEN", "");
      vi.stubEnv("CRON_SECRET", validSecret);
      vi.stubEnv("STORAGE_DRIVER", "s3");
      vi.stubEnv("S3_BUCKET", "private-prescriptions");
    };

    live();
    vi.stubEnv("REDIS_URL", "rediss://default:secret@cache.example.test:6379");
    expect(() => assertEnv()).not.toThrow();

    vi.stubEnv("REDIS_URL", "http://cache.example.test");
    expect(() => assertEnv()).toThrow(/REDIS_URL/);
  });

  it("rejeita AUTH_URL de outro origin em produção", () => {
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv(
      "DATABASE_URL",
      "postgresql://user:pass@db.example.test/store?sslmode=require"
    );
    vi.stubEnv("AUTH_SECRET", validSecret);
    vi.stubEnv("MFA_ENCRYPTION_KEY", validMfaEncryption);
    vi.stubEnv("MFA_RECOVERY_PEPPER", validMfaPepper);
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://loja.example.test");
    vi.stubEnv("AUTH_URL", "https://evil.example.test");
    vi.stubEnv("STRIPE_SECRET_KEY", `sk_live_${"a".repeat(24)}`);
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", `whsec_${"b".repeat(24)}`);
    vi.stubEnv("RESEND_API_KEY", "re_test_value");
    vi.stubEnv("MAIL_FROM", "Loja <noreply@example.test>");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example.test");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "redis-token-with-entropy-123");
    vi.stubEnv("CRON_SECRET", validSecret);
    expect(() => assertEnv()).toThrow(/AUTH_URL/);
  });

  it("rejeita storage implícito ou filesystem efêmero na Vercel", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv(
      "DATABASE_URL",
      "postgresql://user:pass@db.example.test/store?sslmode=require"
    );
    vi.stubEnv("AUTH_SECRET", validSecret);
    vi.stubEnv("MFA_ENCRYPTION_KEY", validMfaEncryption);
    vi.stubEnv("MFA_RECOVERY_PEPPER", validMfaPepper);
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://loja.example.test");
    vi.stubEnv("STRIPE_SECRET_KEY", `sk_live_${"a".repeat(24)}`);
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", `whsec_${"b".repeat(24)}`);
    vi.stubEnv("RESEND_API_KEY", "re_test_value");
    vi.stubEnv("MAIL_FROM", "Loja <noreply@example.test>");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example.test");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "redis-token-with-entropy-123");
    vi.stubEnv("CRON_SECRET", validSecret);
    expect(() => assertEnv()).toThrow(/STORAGE_DRIVER/);

    vi.stubEnv("STORAGE_DRIVER", "local");
    vi.stubEnv("UPLOAD_DIR", "/data/private-uploads");
    expect(() => assertEnv()).toThrow(/filesystem efêmero/);
  });

  it("aceita ambiente de desenvolvimento mínimo com segredo forte", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("DATABASE_URL", "postgresql://localhost/test");
    vi.stubEnv("AUTH_SECRET", validSecret);
    expect(() => assertEnv()).not.toThrow();
  });
});

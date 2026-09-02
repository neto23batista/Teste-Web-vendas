import { describe, expect, it } from "vitest";
import {
  subscriptionNotificationIdempotencyKey,
  subscriptionNotificationRetryAt,
  subscriptionReminderEligible,
} from "@/lib/communications/subscription-notifications";

describe("subscriptionReminderEligible", () => {
  const valid = {
    intervalDays: 30,
    productActive: true,
    requiresPrescription: false,
    email: "pessoa@example.com",
  };

  it("aceita apenas um ciclo suportado e produto livre ativo", () => {
    expect(subscriptionReminderEligible(valid)).toBe(true);
    expect(
      subscriptionReminderEligible({ ...valid, intervalDays: 31 })
    ).toBe(false);
    expect(
      subscriptionReminderEligible({ ...valid, productActive: false })
    ).toBe(false);
    expect(
      subscriptionReminderEligible({ ...valid, requiresPrescription: true })
    ).toBe(false);
  });

  it("bloqueia contas anonimizadas sem depender de caixa", () => {
    expect(
      subscriptionReminderEligible({
        ...valid,
        email: "excluida-id@ANON.INVALID",
      })
    ).toBe(false);
  });
});

describe("subscriptionNotificationRetryAt", () => {
  const now = new Date("2026-08-22T12:00:00.000Z");

  it("começa em um minuto e dobra o intervalo", () => {
    expect(
      subscriptionNotificationRetryAt(1, now).getTime() - now.getTime()
    ).toBe(60_000);
    expect(
      subscriptionNotificationRetryAt(4, now).getTime() - now.getTime()
    ).toBe(8 * 60_000);
  });

  it("limita a espera a 24 horas", () => {
    expect(
      subscriptionNotificationRetryAt(100, now).getTime() - now.getTime()
    ).toBe(24 * 60 * 60_000);
  });
});

describe("subscriptionNotificationIdempotencyKey", () => {
  it("gera chave estável, opaca, ASCII e menor que 256 bytes", () => {
    const first = subscriptionNotificationIdempotencyKey("notification-1");
    const retry = subscriptionNotificationIdempotencyKey("notification-1");
    const other = subscriptionNotificationIdempotencyKey("notification-2");

    expect(first).toBe(retry);
    expect(first).not.toBe(other);
    expect(first).toMatch(/^[A-Za-z0-9/_:.-]+$/);
    expect(Buffer.byteLength(first, "ascii")).toBeLessThanOrEqual(256);
    expect(first).not.toContain("notification-1");
  });
});

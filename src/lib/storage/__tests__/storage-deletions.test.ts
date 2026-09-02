import { describe, expect, it } from "vitest";
import { storageDeletionRetryAt } from "@/lib/storage/deletions";

describe("storageDeletionRetryAt", () => {
  const now = new Date("2026-08-22T12:00:00.000Z");

  it("inicia o retry em um minuto e dobra a espera", () => {
    expect(storageDeletionRetryAt(1, now).getTime() - now.getTime()).toBe(60_000);
    expect(storageDeletionRetryAt(4, now).getTime() - now.getTime()).toBe(480_000);
  });

  it("limita a espera a 24 horas", () => {
    expect(storageDeletionRetryAt(100, now).getTime() - now.getTime()).toBe(
      24 * 60 * 60_000
    );
  });
});

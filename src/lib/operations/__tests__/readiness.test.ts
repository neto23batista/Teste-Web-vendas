import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { EXPECTED_MIGRATION } from "@/lib/operations/readiness";

const migrationsDir = fileURLToPath(
  new URL("../../../../prisma/migrations", import.meta.url)
);

function migrationsOnDisk(): string[] {
  return readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

describe("EXPECTED_MIGRATION", () => {
  it("aponta para a última migration do repositório", () => {
    const migrations = migrationsOnDisk();
    const last = migrations.at(-1);

    // Esquecer de subir a constante junto com uma migration nova faz o
    // /api/ready recusar tráfego DEPOIS que o release foi aplicado com
    // sucesso — a falha aparece em produção, não aqui. Este teste antecipa.
    expect(EXPECTED_MIGRATION).toBe(last);
  });

  it("corresponde a uma migration que existe de fato", () => {
    expect(migrationsOnDisk()).toContain(EXPECTED_MIGRATION);
  });
});

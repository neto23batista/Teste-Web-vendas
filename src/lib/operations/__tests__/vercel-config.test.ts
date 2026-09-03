import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const configPath = fileURLToPath(
  new URL("../../../../vercel.json", import.meta.url)
);

type Cron = { path: string; schedule: string };

function crons(): Cron[] {
  return JSON.parse(readFileSync(configPath, "utf8")).crons ?? [];
}

describe("vercel.json", () => {
  it("não carrega chaves fora do schema nas entradas de cron", () => {
    // A Vercel valida o arquivo antes de construir e recusa propriedade
    // desconhecida em `crons[]` — inclusive a convenção `"//"` usada como
    // comentário, que já derrubou um deploy inteiro na validação. O porquê de
    // cada cadência mora em docs/DEPLOY.md e no próprio route handler.
    for (const cron of crons()) {
      expect(Object.keys(cron).sort()).toEqual(["path", "schedule"]);
    }
  });

  it("mantém cadência diária, exigida pelo plano Hobby", () => {
    // Hobby aceita uma execução por dia por cron; minuto e hora precisam ser
    // fixos. Se o projeto migrar para o Pro, relaxe esta asserção junto com a
    // expressão — a lease em JobLease já cobre a sobreposição.
    for (const cron of crons()) {
      const [minute, hour] = cron.schedule.split(" ");
      expect(minute).toMatch(/^\d+$/);
      expect(hour).toMatch(/^\d+$/);
    }
  });
});

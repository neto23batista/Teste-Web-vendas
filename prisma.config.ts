import path from "node:path";
// Com prisma.config.ts presente, o Prisma NÃO carrega mais o .env
// automaticamente — fazemos isso aqui para os comandos de CLI (migrate, seed,
// studio) enxergarem a DATABASE_URL. Na Vercel as envs já vêm do ambiente, e o
// dotenv simplesmente não acha .env e não faz nada.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});

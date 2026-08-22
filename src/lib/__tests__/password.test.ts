import { describe, expect, it } from "vitest";
import {
  DUMMY_PASSWORD_HASH,
  hashPassword,
  verifyPassword,
} from "@/lib/password";

describe("hash de senha em runtime", () => {
  it("usa bcrypt cost 12 para hashes reais e para o dummy anti-enumeração", async () => {
    const hash = await hashPassword("uma-senha-bem-longa");
    expect(hash).toMatch(/^\$2[aby]\$12\$/);
    expect(DUMMY_PASSWORD_HASH).toMatch(/^\$2[aby]\$12\$/);
    await expect(verifyPassword("uma-senha-bem-longa", hash)).resolves.toBe(true);
  });
});

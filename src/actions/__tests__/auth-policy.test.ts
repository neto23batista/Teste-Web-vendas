import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal";

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  userCreate: vi.fn(),
  signIn: vi.fn(),
  sendMail: vi.fn(),
  rateLimit: vi.fn(),
}));

vi.mock("next-auth", () => ({
  AuthError: class AuthError extends Error {},
}));
vi.mock("@/auth", () => ({
  signIn: mocks.signIn,
  signOut: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique, create: mocks.userCreate },
  },
}));
vi.mock("@/lib/rate-limit", () => ({
  clientIp: vi.fn().mockResolvedValue("127.0.0.1"),
  rateLimit: mocks.rateLimit,
}));
vi.mock("@/lib/mail", () => ({
  baseUrl: () => "https://example.test",
  sendMail: mocks.sendMail,
}));
vi.mock("@/lib/email-templates", () => ({
  welcomeEmail: () => ({ subject: "Bem-vindo", html: "<p>ok</p>" }),
}));
vi.mock("@/lib/password", () => ({
  hashPassword: vi.fn().mockResolvedValue("bcrypt-cost-12"),
}));

import { register } from "@/actions/auth";

function registrationForm() {
  const form = new FormData();
  form.set("name", "Maria Silva");
  form.set("email", "Maria@Exemplo.com");
  form.set("password", "uma-senha-123");
  form.set("confirm", "uma-senha-123");
  form.set("lgpd", "on");
  form.set("termsVersion", TERMS_VERSION);
  form.set("privacyVersion", PRIVACY_VERSION);
  return form;
}

describe("cadastro e evidência de políticas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rateLimit.mockResolvedValue({ ok: true, remaining: 4, resetAt: Date.now() });
    mocks.userFindUnique.mockResolvedValue(null);
    mocks.userCreate.mockResolvedValue({ id: "user-1" });
    mocks.signIn.mockResolvedValue(undefined);
    mocks.sendMail.mockResolvedValue(true);
  });

  it("cria conta e os dois aceites versionados na mesma escrita", async () => {
    await expect(register(undefined, registrationForm())).resolves.toBeUndefined();

    expect(mocks.userCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: "maria@exemplo.com",
        passwordHash: "bcrypt-cost-12",
        policyAcceptances: {
          create: [
            { kind: "TERMS_ACCEPTANCE", version: TERMS_VERSION },
            {
              kind: "PRIVACY_ACKNOWLEDGEMENT",
              version: PRIVACY_VERSION,
            },
          ],
        },
      }),
    });
  });

  it("trata a corrida da constraint de e-mail/CPF sem erro interno", async () => {
    mocks.userCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("unique", {
        code: "P2002",
        clientVersion: "test",
        meta: { target: ["email"] },
      })
    );

    await expect(register(undefined, registrationForm())).resolves.toMatchObject({
      error: expect.stringContaining("e-mail ou CPF"),
    });
    expect(mocks.signIn).not.toHaveBeenCalled();
    expect(mocks.sendMail).not.toHaveBeenCalled();
  });
});

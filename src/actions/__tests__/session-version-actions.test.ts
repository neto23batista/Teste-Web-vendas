import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  txUserUpdate: vi.fn(),
  tokenFindUnique: vi.fn(),
  tokenUpdateMany: vi.fn(),
  hashPassword: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/session", () => ({
  requireUser: vi.fn().mockResolvedValue({ id: "user-1" }),
}));
vi.mock("@/lib/rate-limit", () => ({
  clientIp: vi.fn().mockResolvedValue("127.0.0.1"),
  rateLimit: vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock("@/lib/password", () => ({
  hashPassword: mocks.hashPassword,
  verifyPassword: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/lib/mail", () => ({
  baseUrl: () => "https://example.test",
  sendMail: vi.fn(),
}));
vi.mock("@/lib/email-templates", () => ({
  passwordResetEmail: () => ({ subject: "reset", html: "reset" }),
}));
vi.mock("@/lib/prisma", () => {
  const tx = {
    passwordResetToken: {
      findUnique: mocks.tokenFindUnique,
      updateMany: mocks.tokenUpdateMany,
    },
    user: { update: mocks.txUserUpdate },
  };
  return {
    prisma: {
      user: { findUnique: mocks.userFindUnique, update: mocks.userUpdate },
      passwordResetToken: { updateMany: vi.fn(), create: vi.fn() },
      $transaction: (callback: (value: typeof tx) => unknown) => callback(tx),
    },
  };
});

import { resetPassword } from "@/actions/password-reset";
import { changePassword } from "@/actions/profile";

describe("revogação por troca de senha", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hashPassword.mockResolvedValue("bcrypt-cost-12");
    mocks.userFindUnique.mockResolvedValue({ passwordHash: "old-hash" });
    mocks.userUpdate.mockResolvedValue({});
    mocks.tokenFindUnique.mockResolvedValue({ id: "token-1", userId: "user-1" });
    mocks.tokenUpdateMany.mockResolvedValue({ count: 1 });
    mocks.txUserUpdate.mockResolvedValue({});
  });

  it("incrementa sessionVersion no reset por token", async () => {
    const form = new FormData();
    form.set("token", "a".repeat(64));
    form.set("password", "uma-senha-123");
    form.set("confirm", "uma-senha-123");

    await expect(resetPassword(undefined, form)).resolves.toEqual({ ok: true });
    expect(mocks.txUserUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        passwordHash: "bcrypt-cost-12",
        sessionVersion: { increment: 1 },
      },
    });
  });

  it("incrementa sessionVersion na troca autenticada", async () => {
    const form = new FormData();
    form.set("currentPassword", "senha-atual");
    form.set("newPassword", "uma-senha-123");
    form.set("confirmPassword", "uma-senha-123");

    await expect(changePassword(undefined, form)).resolves.toEqual({ success: true });
    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        passwordHash: "bcrypt-cost-12",
        sessionVersion: { increment: 1 },
      },
    });
  });
});

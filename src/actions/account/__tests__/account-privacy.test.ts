import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  recoveryDeleteMany: vi.fn(),
  favoriteDeleteMany: vi.fn(),
  subscriptionDeleteMany: vi.fn(),
  addressDeleteMany: vi.fn(),
  cartDeleteMany: vi.fn(),
  prescriptionDeleteMany: vi.fn(),
  passwordResetDeleteMany: vi.fn(),
  reviewDeleteMany: vi.fn(),
  loyaltyDeleteMany: vi.fn(),
  auditUpdateMany: vi.fn(),
  transaction: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  requireUser: vi.fn().mockResolvedValue({
    id: "user-1",
    email: "cliente@example.com",
  }),
}));
vi.mock("@/auth", () => ({ signOut: mocks.signOut }));
vi.mock("@/lib/storage", () => ({ deleteObject: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({
  clientIp: vi.fn().mockResolvedValue("127.0.0.1"),
  rateLimit: vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock("@/lib/auth/password", () => ({
  verifyPassword: vi.fn().mockResolvedValue(true),
  hashPassword: vi.fn().mockResolvedValue("invalid-bcrypt-cost-12"),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique, update: mocks.userUpdate },
    prescription: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: mocks.prescriptionDeleteMany,
    },
    review: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: mocks.reviewDeleteMany,
      aggregate: vi.fn(),
    },
    favorite: { deleteMany: mocks.favoriteDeleteMany },
    subscription: { deleteMany: mocks.subscriptionDeleteMany },
    address: { deleteMany: mocks.addressDeleteMany },
    cart: { deleteMany: mocks.cartDeleteMany },
    passwordResetToken: { deleteMany: mocks.passwordResetDeleteMany },
    mfaRecoveryCode: { deleteMany: mocks.recoveryDeleteMany },
    loyaltyAccount: { deleteMany: mocks.loyaltyDeleteMany },
    auditLog: { updateMany: mocks.auditUpdateMany },
    product: { update: vi.fn() },
    $transaction: mocks.transaction,
  },
}));

import { deleteAccount } from "@/actions/account/privacy";

describe("anonimização da conta", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userFindUnique.mockResolvedValue({
      role: "CUSTOMER",
      passwordHash: "hash",
    });
    mocks.userUpdate.mockResolvedValue({});
    mocks.recoveryDeleteMany.mockResolvedValue({ count: 2 });
    for (const deletion of [
      mocks.favoriteDeleteMany,
      mocks.subscriptionDeleteMany,
      mocks.addressDeleteMany,
      mocks.cartDeleteMany,
      mocks.prescriptionDeleteMany,
      mocks.passwordResetDeleteMany,
      mocks.reviewDeleteMany,
      mocks.loyaltyDeleteMany,
      mocks.auditUpdateMany,
    ]) {
      deletion.mockResolvedValue({ count: 0 });
    }
    mocks.transaction.mockImplementation(async (callback) =>
      callback({
        favorite: { deleteMany: mocks.favoriteDeleteMany },
        subscription: { deleteMany: mocks.subscriptionDeleteMany },
        address: { deleteMany: mocks.addressDeleteMany },
        cart: { deleteMany: mocks.cartDeleteMany },
        prescription: { deleteMany: mocks.prescriptionDeleteMany },
        passwordResetToken: { deleteMany: mocks.passwordResetDeleteMany },
        mfaRecoveryCode: { deleteMany: mocks.recoveryDeleteMany },
        review: { deleteMany: mocks.reviewDeleteMany },
        loyaltyAccount: { deleteMany: mocks.loyaltyDeleteMany },
        auditLog: { updateMany: mocks.auditUpdateMany },
        user: { update: mocks.userUpdate },
      })
    );
  });

  it("remove recovery codes, limpa MFA e revoga sessões sem apagar aceites", async () => {
    const form = new FormData();
    form.set("confirmEmail", "cliente@example.com");
    form.set("currentPassword", "senha-atual");

    await expect(deleteAccount(undefined, form)).resolves.toBeUndefined();

    expect(mocks.recoveryDeleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
    });
    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: expect.objectContaining({
        mfaSecretEncrypted: null,
        mfaEnabledAt: null,
        sessionVersion: { increment: 1 },
      }),
    });
    // PolicyAcceptance permanece ligada ao User anonimizado como evidência.
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.signOut).toHaveBeenCalledWith({ redirectTo: "/?conta=excluida" });
  });
});

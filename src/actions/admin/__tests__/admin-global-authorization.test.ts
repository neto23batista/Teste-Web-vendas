import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertOwner: vi.fn(),
  stripePing: vi.fn(),
  settingUpsert: vi.fn(),
  transaction: vi.fn(),
  couponFindUnique: vi.fn(),
  couponCreate: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ assertOwner: mocks.assertOwner }));
vi.mock("@/lib/payments/stripe", () => ({ stripePing: mocks.stripePing }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    setting: {
      upsert: mocks.settingUpsert,
      deleteMany: vi.fn(),
    },
    coupon: {
      findUnique: mocks.couponFindUnique,
      create: mocks.couponCreate,
      update: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: mocks.transaction,
  },
}));

import {
  saveSettings,
  testStripeConnection,
} from "@/actions/admin/settings";
import { createCoupon } from "@/actions/admin/coupons";

describe("mutações administrativas globais", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertOwner.mockResolvedValue({ pharmacyType: "FILIAL" });
  });

  it("nega configurações globais a owner de filial", async () => {
    await expect(testStripeConnection()).rejects.toThrow("matriz");
    await expect(saveSettings(undefined, new FormData())).rejects.toThrow("matriz");

    expect(mocks.stripePing).not.toHaveBeenCalled();
    expect(mocks.settingUpsert).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("nega cupom compartilhado a owner de filial", async () => {
    const form = new FormData();
    form.set("code", "TESTE10");
    form.set("type", "PERCENT");
    form.set("value", "10");

    await expect(createCoupon(undefined, form)).rejects.toThrow("matriz");
    expect(mocks.couponFindUnique).not.toHaveBeenCalled();
    expect(mocks.couponCreate).not.toHaveBeenCalled();
  });
});

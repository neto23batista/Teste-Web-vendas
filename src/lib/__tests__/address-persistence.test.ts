import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  addressCount: vi.fn(),
  addressUpdateMany: vi.fn(),
  addressCreate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: mocks.transaction },
}));

import { createUserAddressWithinLimit } from "@/lib/address-persistence";

const address = {
  label: "Casa",
  recipient: "Maria Silva",
  zip: "01001000",
  street: "Praça da Sé",
  number: "1",
  complement: null,
  district: "Sé",
  city: "São Paulo",
  state: "SP",
  isDefault: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
    callback({
      $queryRaw: mocks.queryRaw,
      address: {
        count: mocks.addressCount,
        updateMany: mocks.addressUpdateMany,
        create: mocks.addressCreate,
      },
    })
  );
  mocks.queryRaw.mockResolvedValue([{ pg_advisory_xact_lock: null }]);
  mocks.addressUpdateMany.mockResolvedValue({ count: 0 });
  mocks.addressCreate.mockResolvedValue({ id: "address-1", ...address });
});

describe("cadastro transacional de endereço", () => {
  it("faz lock, count e create na mesma transação", async () => {
    mocks.addressCount.mockResolvedValue(19);

    await expect(createUserAddressWithinLimit("user-1", address)).resolves.toMatchObject({
      ok: true,
      address: { id: "address-1" },
    });

    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.queryRaw).toHaveBeenCalledTimes(1);
    expect(mocks.addressCount).toHaveBeenCalledWith({ where: { userId: "user-1" } });
    expect(mocks.addressCreate).toHaveBeenCalledWith({
      data: { ...address, userId: "user-1", isDefault: false },
    });
    expect(mocks.queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.addressCount.mock.invocationCallOrder[0]
    );
    expect(mocks.addressCount.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.addressCreate.mock.invocationCallOrder[0]
    );
  });

  it("recusa o 21º endereço ainda sob o lock", async () => {
    mocks.addressCount.mockResolvedValue(20);

    await expect(createUserAddressWithinLimit("user-1", address)).resolves.toEqual({
      ok: false,
      reason: "limit",
    });

    expect(mocks.queryRaw).toHaveBeenCalledTimes(1);
    expect(mocks.addressCreate).not.toHaveBeenCalled();
  });

  it("torna o primeiro endereço padrão antes de criá-lo", async () => {
    mocks.addressCount.mockResolvedValue(0);
    await createUserAddressWithinLimit("user-1", address);

    expect(mocks.addressUpdateMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      data: { isDefault: false },
    });
    expect(mocks.addressCreate).toHaveBeenCalledWith({
      data: { ...address, userId: "user-1", isDefault: true },
    });
  });
});

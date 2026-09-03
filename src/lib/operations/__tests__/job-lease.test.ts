import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  updateMany: vi.fn(),
  create: vi.fn(),
  reportError: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { jobLease: { updateMany: mocks.updateMany, create: mocks.create } },
}));
vi.mock("@/lib/monitoring", () => ({ reportError: mocks.reportError }));

import { Prisma } from "@prisma/client";
import { withJobLease } from "@/lib/operations/job-lease";

const conflict = () =>
  new Prisma.PrismaClientKnownRequestError("já existe", {
    code: "P2002",
    clientVersion: "test",
  });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.updateMany.mockResolvedValue({ count: 0 });
  mocks.create.mockResolvedValue({});
});

describe("lease de execução de job", () => {
  it("executa quando ninguém segura a lease", async () => {
    const run = vi.fn().mockResolvedValue("pronto");

    const outcome = await withJobLease("payments", 60_000, run);

    expect(outcome).toEqual({ ran: true, result: "pronto" });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("retoma uma lease vencida em vez de esperar o TTL", async () => {
    mocks.updateMany.mockResolvedValueOnce({ count: 1 });
    const run = vi.fn().mockResolvedValue(null);

    const outcome = await withJobLease("payments", 60_000, run);

    expect(outcome.ran).toBe(true);
    // Retomou pelo UPDATE condicional; não tentou criar linha nova.
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.updateMany.mock.calls[0]![0].where).toMatchObject({
      name: "payments",
      expiresAt: { lte: expect.any(Date) },
    });
  });

  it("não roda em paralelo quando outra execução ainda está viva", async () => {
    mocks.create.mockRejectedValueOnce(conflict());
    const run = vi.fn();

    const outcome = await withJobLease("payments", 60_000, run);

    expect(outcome).toEqual({ ran: false });
    expect(run).not.toHaveBeenCalled();
  });

  it("libera a lease mesmo quando o job falha", async () => {
    const boom = new Error("provedor fora do ar");

    await expect(
      withJobLease("payments", 60_000, () => Promise.reject(boom)),
    ).rejects.toThrow(boom);

    // Última chamada é a liberação: vence a lease imediatamente.
    const release = mocks.updateMany.mock.calls.at(-1)![0];
    expect(release.where).toMatchObject({ name: "payments" });
    expect(release.data.expiresAt).toBeInstanceOf(Date);
  });

  it("falha ao liberar não derruba o job já concluído", async () => {
    mocks.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockRejectedValueOnce(new Error("conexão caiu"));

    const outcome = await withJobLease("payments", 60_000, async () => "ok");

    expect(outcome).toEqual({ ran: true, result: "ok" });
    expect(mocks.reportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ operation: "job.lease.release" }),
    );
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  reportError: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { $queryRaw: mocks.queryRaw },
}));
vi.mock("@/lib/monitoring", () => ({
  reportError: mocks.reportError,
}));

import { GET } from "@/app/api/ready/route";
import { EXPECTED_MIGRATION } from "@/lib/readiness";

describe("GET /api/ready", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("aceita tráfego quando banco e migration esperada estão prontos", async () => {
    mocks.queryRaw.mockResolvedValue([{ ready: true }]);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ ok: true });
    expect(mocks.queryRaw.mock.calls[0]?.[1]).toBe(EXPECTED_MIGRATION);
  });

  it("falha fechado sem expor banco ou nome da migration", async () => {
    mocks.queryRaw.mockResolvedValue([{ ready: false }]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({ ok: false });
    expect(JSON.stringify(body)).not.toContain(EXPECTED_MIGRATION);
    expect(JSON.stringify(body)).not.toMatch(/database|migration|postgres/i);
    expect(mocks.reportError).not.toHaveBeenCalled();
  });

  it("reporta indisponibilidade internamente e mantém resposta opaca", async () => {
    const failure = new Error("connection refused at private-db.internal");
    mocks.queryRaw.mockRejectedValue(failure);

    const response = await GET();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false });
    expect(mocks.reportError).toHaveBeenCalledWith(failure, {
      operation: "readiness.check",
    });
  });
});

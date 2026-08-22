import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  unstable_cache: (fn: unknown) => fn,
}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { missingRegulatoryDisclosure } from "@/lib/settings";

const complete = {
  legalName: "Farmácia Exemplo Ltda.",
  cnpj: "00.000.000/0001-00",
  address: "Rua Exemplo, 10, Centro, São Paulo/SP, 00000-000",
  hours: "Seg a sex, 8h às 18h",
  phone: "(11) 3000-0000",
  pharmacistName: "Responsável Exemplo",
  pharmacistCrf: "CRF/SP 00000",
  sanitaryLicense: "VISA 00000",
  afe: "AFE 00000",
  ae: "",
};

describe("divulgação regulatória", () => {
  it("considera AE condicional", () => {
    expect(missingRegulatoryDisclosure(complete)).toEqual([]);
  });

  it("lista campos obrigatórios ausentes e rejeita espaços", () => {
    const missing = missingRegulatoryDisclosure({
      ...complete,
      legalName: " ",
      sanitaryLicense: "",
      afe: "",
    });
    expect(missing).toEqual(["razão social", "licença sanitária", "AFE"]);
  });
});

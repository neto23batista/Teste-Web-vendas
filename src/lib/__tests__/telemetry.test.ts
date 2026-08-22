import { describe, expect, it } from "vitest";
import { scrubSentryEvent } from "@/lib/telemetry";

describe("scrubSentryEvent", () => {
  it("remove PII, segredos, cookies, corpo e query antes do envio", () => {
    const original = {
      event_id: "evt_safe",
      user: { id: "usr_123", email: "pessoa@example.com" },
      request: {
        url: "https://loja.test/conta?token=segredo&busca=dor",
        headers: {
          authorization: "Bearer muito-secreto",
          cookie: "session=abc",
          "user-agent": "navegador-seguro",
        },
        data: { cpf: "123.456.789-00", address: "Rua Exemplo" },
        query_string: "busca=dor&email=pessoa@example.com",
      },
      extra: {
        customerName: "Pessoa da Silva",
        accessToken: "segredo-camel-case",
        contact: "pessoa@example.com",
        safeCount: 3,
      },
      breadcrumbs: [
        { message: "Falha para 123.456.789-00", data: { body: "segredo" } },
      ],
    };

    const scrubbed = scrubSentryEvent(original);
    const serialized = JSON.stringify(scrubbed);

    expect(serialized).not.toContain("usr_123");
    expect(serialized).not.toContain("pessoa@example.com");
    expect(serialized).not.toContain("muito-secreto");
    expect(serialized).not.toContain("session=abc");
    expect(serialized).not.toContain("123.456.789-00");
    expect(serialized).not.toContain("Rua Exemplo");
    expect(serialized).not.toContain("busca=dor");
    expect(serialized).not.toContain("segredo-camel-case");
    expect(scrubbed.event_id).toBe("evt_safe");
    expect(scrubbed.extra.safeCount).toBe(3);
    expect(scrubbed.request.headers["user-agent"]).toBe("navegador-seguro");
  });

  it("não modifica o evento de origem", () => {
    const original = { user: { email: "pessoa@example.com" }, message: "seguro" };
    const scrubbed = scrubSentryEvent(original);

    expect(original.user.email).toBe("pessoa@example.com");
    expect(scrubbed).not.toBe(original);
  });
});

import { describe, expect, it } from "vitest";
import {
  boundedInterval,
  createSerialExecutor,
  normalizeServiceUrl,
  safeErrorMessage,
} from "../../../connector/security.mjs";

describe("segurança do conector", () => {
  it("exige HTTPS para a nuvem, exceto localhost", () => {
    expect(() =>
      normalizeServiceUrl("http://farmavida.example", { label: "FARMAVIDA_URL" })
    ).toThrow(/HTTPS/);
    expect(
      normalizeServiceUrl("https://farmavida.example/", {
        label: "FARMAVIDA_URL",
      })
    ).toBe("https://farmavida.example");
    expect(normalizeServiceUrl("http://localhost:3000")).toBe(
      "http://localhost:3000"
    );
  });

  it("aceita HTTP local para a API on-premise e recusa credencial na URL", () => {
    expect(
      normalizeServiceUrl("http://192.168.1.20:9800", { localService: true })
    ).toBe("http://192.168.1.20:9800");
    expect(() =>
      normalizeServiceUrl("https://usuario:senha@example.test")
    ).toThrow(/credenciais/);
    expect(() =>
      normalizeServiceUrl("http://fc-malicioso.example", { localService: true })
    ).toThrow(/HTTPS/);
  });

  it("valida intervalos sem fallback silencioso", () => {
    const options = { fallback: 30, min: 5, max: 3600, label: "POLL" };
    expect(boundedInterval(undefined, options)).toBe(30);
    expect(boundedInterval("60", options)).toBe(60);
    expect(() => boundedInterval("0", options)).toThrow(/entre 5 e 3600/);
    expect(() => boundedInterval("abc", options)).toThrow(/entre 5 e 3600/);
  });

  it("remove credenciais e PII de mensagens de erro", () => {
    const safe = safeErrorMessage(
      new Error(
        "Bearer fvi_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa email joao@example.com CPF 123.456.789-00"
      )
    );
    expect(safe).not.toContain("fvi_");
    expect(safe).not.toContain("joao@example.com");
    expect(safe).not.toContain("123.456.789-00");
  });

  it("serializa tarefas concorrentes em uma fila compartilhada", async () => {
    const execute = createSerialExecutor();
    const order: string[] = [];
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = execute(async () => {
      order.push("primeira-inicio");
      await firstGate;
      order.push("primeira-fim");
    });
    const second = execute(async () => {
      order.push("segunda");
    });

    await Promise.resolve();
    expect(order).toEqual(["primeira-inicio"]);
    releaseFirst();
    await Promise.all([first, second]);
    expect(order).toEqual(["primeira-inicio", "primeira-fim", "segunda"]);
  });
});

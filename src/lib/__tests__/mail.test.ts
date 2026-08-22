import { afterEach, describe, expect, it, vi } from "vitest";
import { sendMail } from "@/lib/mail";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("mail", () => {
  it("não registra destinatário ou conteúdo quando o provedor está ausente", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("MAIL_FROM", "");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    expect(
      await sendMail({
        to: "pessoa@example.com",
        subject: "Redefinir senha",
        html: '<a href="https://app.test/reset?token=segredo">redefinir</a>',
      })
    ).toBe(false);

    expect(String(info.mock.calls[0]?.[0])).not.toContain("pessoa@example.com");
    expect(String(info.mock.calls[0]?.[0])).not.toContain("segredo");
  });

  it("limita a espera e não copia o corpo de erro do provedor para logs", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_secret_value");
    vi.stubEnv("MAIL_FROM", "Loja <noreply@example.test>");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response("pessoa@example.com?token=segredo", { status: 400 })
      );
    vi.stubGlobal("fetch", fetchMock);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(
      await sendMail({
        to: "pessoa@example.com",
        subject: "Assunto",
        html: "Mensagem privada",
        idempotencyKey: "subscription/notification-1",
      })
    ).toBe(false);

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(new Headers(init.headers).get("Idempotency-Key")).toBe(
      "subscription/notification-1"
    );
    const serialized = String(error.mock.calls[0]?.[0]);
    expect(serialized).toContain("Resend request failed (400)");
    expect(serialized).not.toContain("pessoa@example.com");
    expect(serialized).not.toContain("segredo");
  });
});

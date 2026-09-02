import { describe, expect, it } from "vitest";
import {
  readTextBodyLimited,
  RequestBodyTooLargeError,
} from "@/lib/security/request-body";

describe("readTextBodyLimited", () => {
  it("lê um corpo UTF-8 dentro do limite", async () => {
    const request = new Request("https://example.test/webhook", {
      method: "POST",
      body: "olá",
    });

    await expect(readTextBodyLimited(request, 8)).resolves.toBe("olá");
  });

  it("aceita um corpo exatamente no limite", async () => {
    const request = new Request("https://example.test/webhook", {
      method: "POST",
      body: "1234",
    });

    await expect(readTextBodyLimited(request, 4)).resolves.toBe("1234");
  });

  it("recusa imediatamente um Content-Length acima do limite", async () => {
    const request = new Request("https://example.test/webhook", {
      method: "POST",
      headers: { "content-length": "1048577" },
      body: "x",
    });

    await expect(readTextBodyLimited(request, 1024 * 1024)).rejects.toBeInstanceOf(
      RequestBodyTooLargeError
    );
  });

  it("interrompe um stream sem Content-Length que ultrapassa o limite", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("1234"));
        controller.enqueue(new TextEncoder().encode("5"));
        controller.close();
      },
    });
    const request = new Request("https://example.test/webhook", {
      method: "POST",
      body: stream,
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    await expect(readTextBodyLimited(request, 4)).rejects.toBeInstanceOf(
      RequestBodyTooLargeError
    );
  });
});

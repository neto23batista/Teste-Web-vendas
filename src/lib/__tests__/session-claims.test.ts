import { describe, expect, it } from "vitest";
import { hasVersionedSessionClaims } from "@/lib/session-claims";

describe("hasVersionedSessionClaims", () => {
  it("aceita somente os claims completos da sessão atual", () => {
    expect(
      hasVersionedSessionClaims({ sessionVersion: 0, mfaEnabled: false })
    ).toBe(true);
    expect(
      hasVersionedSessionClaims({ sessionVersion: 12, mfaEnabled: true })
    ).toBe(true);
  });

  it.each([
    null,
    {},
    { sessionVersion: 0 },
    { mfaEnabled: false },
    { sessionVersion: -1, mfaEnabled: false },
    { sessionVersion: 1.5, mfaEnabled: false },
    { sessionVersion: "1", mfaEnabled: false },
    { sessionVersion: 1, mfaEnabled: "false" },
  ])("rejeita cookie ausente, legado ou malformado: %j", (claims) => {
    expect(hasVersionedSessionClaims(claims)).toBe(false);
  });
});

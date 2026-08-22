import { describe, expect, it } from "vitest";
import { toCsv } from "@/lib/csv";

describe("toCsv", () => {
  it("neutraliza fórmulas vindas de campos textuais", () => {
    const csv = toCsv([
      ["nome", "observação"],
      ["=HYPERLINK(\"https://example.test\")", "+cmd"],
      ["  -2+3", "@SUM(A1:A2)"],
    ]);

    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("'+cmd");
    expect(csv).toContain("'  -2+3");
    expect(csv).toContain("'@SUM");
  });

  it("preserva valores numéricos como números", () => {
    expect(toCsv([[10, -20.5]])).toBe("10,-20.5");
  });
});

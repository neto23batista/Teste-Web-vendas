import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Field, Input } from "./input";

describe("Field accessibility contract", () => {
  it("associates label, hint and error without losing an existing description", () => {
    const html = renderToStaticMarkup(Field({
      label: "CEP", htmlFor: "zip", hint: "Oito dígitos", error: "Confira o CEP", required: true,
      children: createElement(Input, { id: "zip", name: "zip", "aria-describedby": "external" }),
    }));
    expect(html).toContain('for="zip"');
    expect(html).toContain('aria-describedby="external zip-hint zip-error"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('id="zip-hint"');
    expect(html).toContain('id="zip-error"');
    expect(html).toContain('role="alert"');
    expect(html).toContain('required=""');
  });
  it("preserves unrelated child controls and their accessible metadata", () => {
    const html = renderToStaticMarkup(Field({ label: "Nome", htmlFor: "name", hint: "Completo",
      children: createElement(Input, { id: "other", "aria-describedby": "own", "aria-invalid": true }),
    }));
    expect(html).toContain('aria-describedby="own"');
    expect(html).not.toContain('aria-describedby="own name-hint"');
  });
});

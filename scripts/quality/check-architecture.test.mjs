import assert from "node:assert/strict";
import test from "node:test";
import { checkArchitecture, inspectSource } from "./check-architecture.mjs";

const inspect = (files, options) =>
  checkArchitecture(new Map(Object.entries(files)), options).errors;

test("distingue imports de tipos de dependências de execução", () => {
  const result = inspectSource(
    "example.ts",
    'import type { A } from "a"; import { type B } from "b"; import { C } from "c";',
  );
  assert.deepEqual(
    result.imports.map((entry) => entry.typeOnly),
    [true, true, false],
  );
});

test("cliente chama Server Action sem carregar o backend", () => {
  assert.deepEqual(
    inspect({
      "src/components/form.tsx":
        '"use client"; import { save } from "@/actions/account/save";',
      "src/actions/account/save.ts":
        '"use server"; import { readFile } from "node:fs"; export async function save() {}',
    }),
    [],
  );
});

test("detecta dependência de banco indireta no cliente", () => {
  const errors = inspect({
    "src/components/form.tsx":
      '"use client"; import { helper } from "@/lib/helper";',
    "src/lib/helper.ts":
      'import { PrismaClient } from "@prisma/client"; export const helper = 1;',
  });
  assert.ok(
    errors.some(
      (error) =>
        error.includes("Bundle cliente") && error.includes("@prisma/client"),
    ),
  );
});

test("tipos do servidor não contaminam o bundle cliente", () => {
  assert.deepEqual(
    inspect({
      "src/components/form.tsx":
        '"use client"; import type { Input } from "@/lib/model";',
      "src/lib/model.ts": 'import "server-only"; export type Input = string;',
    }),
    [],
  );
});

test("impede segredo privado no cliente, mas permite configuração pública", () => {
  assert.ok(
    inspect({
      "src/components/a.tsx":
        '"use client"; const token = process.env.AUTH_SECRET;',
    }).some((error) => error.includes("AUTH_SECRET")),
  );
  assert.deepEqual(
    inspect({
      "src/components/a.tsx":
        '"use client"; const title = process.env.NEXT_PUBLIC_APP_NAME;',
    }),
    [],
  );
});

test("ações exigem diretiva e exports assíncronos", () => {
  const errors = inspect({
    "src/actions/admin/save.ts": 'export const key = "not-an-action";',
  });
  assert.ok(errors.some((error) => error.includes('sem "use server"')));
  assert.ok(errors.some((error) => error.includes("não é uma Server Action")));
});

test("lib não pode importar ações de interface", () => {
  const errors = inspect({
    "src/lib/helper.ts": 'import { save } from "@/actions/admin/save";',
    "src/actions/admin/save.ts":
      '"use server"; export async function save() {}',
  });
  assert.ok(errors.some((error) => error.includes("lib não deve depender")));
});

test("imports quebrados e diferenças de maiúsculas são detectados no Windows", () => {
  const errors = inspect({
    "src/lib/a.ts": 'import { b } from "./B"; import { gone } from "./gone";',
    "src/lib/b.ts": "export const b = 1;",
  });
  assert.ok(errors.some((error) => error.includes("capitalização incorreta")));
  assert.ok(errors.some((error) => error.includes("não encontrado")));
});

test("detecta ciclos entre módulos de negócio", () => {
  const errors = inspect({
    "src/lib/a.ts": 'import { b } from "./b"; export const a = b;',
    "src/lib/b.ts": 'import { a } from "./a"; export const b = a;',
  });
  assert.ok(errors.some((error) => error.includes("Dependência circular")));
});

test("mantém um limite explícito de tamanho por módulo", () => {
  assert.ok(
    inspect({ "src/lib/a.ts": "\n\n\n" }, { maxLines: 2 }).some((error) =>
      error.includes("divida responsabilidades"),
    ),
  );
});

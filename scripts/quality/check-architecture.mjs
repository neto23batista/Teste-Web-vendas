import fs from "node:fs";
import path from "node:path";
import { builtinModules } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const normalize = (value) => value.replaceAll("\\", "/");
const serverPackages = new Set([
  ...builtinModules,
  ...builtinModules.map((name) => `node:${name}`),
  "server-only",
  "next/headers",
  "next/cache",
  "next/server",
  "@prisma/client",
]);

/** Extrai dependências de execução; import/export type não vai para o navegador. */
export function inspectSource(file, content) {
  const source = ts.createSourceFile(
    file,
    content,
    ts.ScriptTarget.Latest,
    true,
  );
  const imports = [];
  const secrets = new Set();
  const directives = new Set();
  const invalidActionExports = [];

  for (const statement of source.statements) {
    if (
      ts.isExpressionStatement(statement) &&
      ts.isStringLiteral(statement.expression)
    ) {
      directives.add(statement.expression.text);
    }
    if (
      statement.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
      )
    ) {
      if (
        ts.isTypeAliasDeclaration(statement) ||
        ts.isInterfaceDeclaration(statement)
      )
        continue;
      if (
        !ts.isFunctionDeclaration(statement) ||
        !statement.modifiers.some(
          (modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword,
        )
      ) {
        invalidActionExports.push(
          statement.name?.getText(source) ?? "export não assíncrono",
        );
      }
    }
  }

  function visit(node) {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const clause = node.importClause;
      const allTypes =
        clause?.namedBindings &&
        ts.isNamedImports(clause.namedBindings) &&
        clause.namedBindings.elements.length > 0 &&
        clause.namedBindings.elements.every((element) => element.isTypeOnly);
      imports.push({
        specifier: node.moduleSpecifier.text,
        typeOnly: Boolean(clause?.isTypeOnly || (!clause?.name && allTypes)),
      });
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const allTypes =
        node.exportClause &&
        ts.isNamedExports(node.exportClause) &&
        node.exportClause.elements.length > 0 &&
        node.exportClause.elements.every((element) => element.isTypeOnly);
      imports.push({
        specifier: node.moduleSpecifier.text,
        typeOnly: Boolean(node.isTypeOnly || allTypes),
      });
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) &&
          node.expression.text === "require"))
    ) {
      if (
        node.arguments.length === 1 &&
        ts.isStringLiteral(node.arguments[0])
      ) {
        imports.push({ specifier: node.arguments[0].text, typeOnly: false });
      }
    }
    if (
      ts.isPropertyAccessExpression(node) &&
      node.expression.getText(source) === "process.env"
    ) {
      const name = node.name.text;
      if (name !== "NODE_ENV" && !name.startsWith("NEXT_PUBLIC_"))
        secrets.add(name);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return {
    imports,
    secrets: [...secrets],
    directives,
    invalidActionExports,
    lines: content.split(/\r?\n/).length,
  };
}

export function checkArchitecture(files, { maxLines = 650 } = {}) {
  const errors = new Set();
  const modules = new Map(
    [...files].map(([file, content]) => [
      normalize(file),
      inspectSource(file, content),
    ]),
  );
  const lowerPaths = new Map(
    [...modules.keys()].map((file) => [file.toLowerCase(), file]),
  );
  const edges = new Map([...modules.keys()].map((file) => [file, []]));

  function resolve(file, specifier) {
    const base = specifier.startsWith("@/")
      ? `src/${specifier.slice(2)}`
      : specifier.startsWith(".")
        ? normalize(path.posix.join(path.posix.dirname(file), specifier))
        : null;
    if (!base) return null;
    if (/\.(css|svg|png|jpe?g|webp|ico|json)$/.test(base)) return null;
    const candidates = [
      base,
      `${base}.ts`,
      `${base}.tsx`,
      `${base}/index.ts`,
      `${base}/index.tsx`,
    ];
    const exact = candidates.find((candidate) => modules.has(candidate));
    if (exact) return exact;
    const wrongCase = candidates
      .map((candidate) => lowerPaths.get(candidate.toLowerCase()))
      .find(Boolean);
    errors.add(
      wrongCase
        ? `${file}: capitalização incorreta em ${specifier}; use ${wrongCase}`
        : `${file}: import local não encontrado: ${specifier}`,
    );
    return wrongCase ?? null;
  }

  for (const [file, module] of modules) {
    if (module.lines > maxLines)
      errors.add(
        `${file}: ${module.lines} linhas; divida responsabilidades (limite ${maxLines}).`,
      );
    if (file.startsWith("src/actions/")) {
      if (!/^src\/actions\/(admin|account|store)\//.test(file))
        errors.add(`${file}: ação fora dos domínios admin/account/store.`);
      if (!module.directives.has("use server"))
        errors.add(`${file}: Server Action sem "use server".`);
      for (const name of module.invalidActionExports)
        errors.add(
          `${file}: export ${name} não é uma Server Action assíncrona; mova auxiliares para lib.`,
        );
    }
    for (const dependency of module.imports) {
      const target = resolve(file, dependency.specifier);
      if (!target || dependency.typeOnly) continue;
      edges.get(file).push(target);
      if (
        file.startsWith("src/lib/") &&
        /^src\/(actions|app|components|hooks)\//.test(target)
      ) {
        errors.add(`${file}: lib não deve depender da camada ${target}.`);
      }
    }
  }

  // Uma Server Action é uma fronteira RPC, não uma dependência de bundle cliente.
  for (const [entry, module] of modules) {
    if (!module.directives.has("use client")) continue;
    const seen = new Set();
    function visit(file, trail) {
      if (seen.has(file)) return;
      seen.add(file);
      const current = modules.get(file);
      if (current.directives.has("use server")) return;
      const forbidden = current.imports.find(
        (dependency) =>
          !dependency.typeOnly && serverPackages.has(dependency.specifier),
      );
      if (forbidden || current.secrets.length) {
        errors.add(
          `Bundle cliente: ${[...trail, file].join(" -> ")} usa ${forbidden?.specifier ?? `process.env.${current.secrets[0]}`}.`,
        );
      }
      for (const next of edges.get(file)) visit(next, [...trail, file]);
    }
    visit(entry, []);
  }

  const visited = new Set();
  const active = [];
  function visitCycle(file) {
    if (!file.startsWith("src/lib/")) return;
    if (active.includes(file)) {
      errors.add(
        `Dependência circular: ${[...active.slice(active.indexOf(file)), file].join(" -> ")}`,
      );
      return;
    }
    if (visited.has(file)) return;
    visited.add(file);
    active.push(file);
    for (const next of edges.get(file)) visitCycle(next);
    active.pop();
  }
  for (const file of modules.keys()) visitCycle(file);
  return { errors: [...errors].sort(), moduleCount: modules.size };
}

function readSources(directory, root, files = new Map()) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (
      entry.isDirectory() &&
      entry.name !== "__tests__" &&
      entry.name !== "generated"
    )
      readSources(filename, root, files);
    else if (
      entry.isFile() &&
      /\.tsx?$/.test(entry.name) &&
      !/\.(test|spec)\.tsx?$/.test(entry.name)
    ) {
      files.set(
        normalize(path.relative(root, filename)),
        fs.readFileSync(filename, "utf8"),
      );
    }
  }
  return files;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const result = checkArchitecture(readSources(path.join(root, "src"), root));
  if (result.errors.length) {
    console.error(result.errors.join("\n"));
    process.exitCode = 1;
  } else
    console.log(
      `Arquitetura válida: ${result.moduleCount} módulos, imports resolvidos e fronteiras cliente/servidor preservadas.`,
    );
}

export const DISPOSABLE_DATABASE_CONFIRMATION =
  "I_UNDERSTAND_THIS_IS_A_DISPOSABLE_DATABASE";
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/** Nenhum diagnóstico devolve a URL, que pode conter credenciais. */
export function assertDisposableTestDatabase(input: {
  url?: string;
  confirmation?: string;
  appEnv?: string;
  vercelEnv?: string;
}): string {
  if (input.appEnv === "production" || input.vercelEnv === "production") {
    throw new Error(
      "Testes de escrita não podem usar um ambiente de produção.",
    );
  }
  if (input.confirmation !== DISPOSABLE_DATABASE_CONFIRMATION) {
    throw new Error(
      "Confirme explicitamente o uso de um banco descartável para os testes de escrita.",
    );
  }
  let database: URL;
  try {
    database = new URL(input.url ?? "");
  } catch {
    throw new Error("Configure uma URL PostgreSQL local para os testes.");
  }
  const databaseName = database.pathname.slice(1);
  if (
    !["postgres:", "postgresql:"].includes(database.protocol) ||
    !LOOPBACK_HOSTS.has(database.hostname) ||
    !/^[a-zA-Z0-9_-]+_test$/.test(databaseName)
  ) {
    throw new Error(
      "Os testes exigem PostgreSQL em loopback e um banco com nome terminado em _test.",
    );
  }
  for (const key of database.searchParams.keys()) {
    if (
      ["host", "hostaddr", "port", "dbname", "service", "socket"].includes(
        key.toLowerCase(),
      )
    ) {
      throw new Error(
        "A URL de testes não pode redirecionar o host ou o banco por parâmetros.",
      );
    }
  }
  return input.url!;
}

export function assertLocalTestServer(value: string): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Servidor E2E inválido.");
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    !LOOPBACK_HOSTS.has(url.hostname) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "E2E com escrita exige servidor local, sem credenciais nem caminhos na URL base.",
    );
  }
}

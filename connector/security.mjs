const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function normalizedHostname(url) {
  return url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
}

function isPrivateIpv4(hostname) {
  const parts = hostname.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) {
    return false;
  }
  const octets = parts.map(Number);
  if (octets.some((part) => part > 255)) return false;
  return (
    octets[0] === 10 ||
    octets[0] === 127 ||
    (octets[0] === 169 && octets[1] === 254) ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168)
  );
}

function isPrivateHost(hostname) {
  if (LOOPBACK_HOSTS.has(hostname) || isPrivateIpv4(hostname)) return true;
  if (hostname.endsWith(".local") || !hostname.includes(".")) return true;
  return (
    hostname.includes(":") &&
    (hostname.startsWith("fc") || hostname.startsWith("fd") || hostname.startsWith("fe80:"))
  );
}

/** Valida uma URL-base sem repetir seu valor (que pode conter segredo) no erro. */
export function normalizeServiceUrl(raw, options = {}) {
  const label = options.label || "URL";
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${label} deve ser uma URL válida.`);
  }

  if (!new Set(["http:", "https:"]).has(url.protocol)) {
    throw new Error(`${label} deve usar HTTP ou HTTPS.`);
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(`${label} não pode conter credenciais, query ou fragmento.`);
  }

  const hostname = normalizedHostname(url);
  const httpAllowed = options.localService
    ? isPrivateHost(hostname)
    : LOOPBACK_HOSTS.has(hostname);
  if (url.protocol !== "https:" && !httpAllowed) {
    throw new Error(`${label} deve usar HTTPS fora de um endpoint local permitido.`);
  }

  return url.href.replace(/\/+$/, "");
}

/** Configuração inválida falha cedo, em vez de criar um loop agressivo. */
export function boundedInterval(raw, options) {
  const value = raw === undefined || raw === "" ? options.fallback : Number(raw);
  if (
    !Number.isInteger(value) ||
    value < options.min ||
    value > options.max
  ) {
    throw new Error(
      `${options.label} deve ser um inteiro entre ${options.min} e ${options.max}.`
    );
  }
  return value;
}

export function safeErrorMessage(error, maxLength = 400) {
  const message = error instanceof Error ? error.message : String(error);
  const redacted = message
    .replace(/[\r\n\t]+/g, " ")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/\bfvi_[a-f0-9]{16,}\b/gi, "[redacted-token]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted-email]")
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[redacted-cpf]")
    .replace(/((?:https?):\/\/)[^@\s/]+@/gi, "$1[redacted]@")
    .replace(
      /((?:authorization|client_secret|password|secret|token|api[_-]?key)\s*[:=]\s*)[^\s,;}&]+/gi,
      "$1[redacted]"
    )
    .replace(/([?&](?:token|code|secret|key|password|signature)=)[^&\s]+/gi, "$1[redacted]");
  return redacted.slice(0, maxLength);
}

/** Uma fila compartilhada impede sobreposição entre tipos de sincronização. */
export function createSerialExecutor() {
  let tail = Promise.resolve();
  return function execute(task) {
    const current = tail.then(task);
    tail = current.then(
      () => undefined,
      () => undefined
    );
    return current;
  };
}

/** Agenda o próximo ciclo somente depois de o anterior terminar. */
export function scheduleAfterCompletion(task, intervalMs) {
  let timer = null;
  let stopped = false;
  const tick = async () => {
    await task();
    if (!stopped) timer = setTimeout(tick, intervalMs);
  };
  timer = setTimeout(tick, intervalMs);
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}

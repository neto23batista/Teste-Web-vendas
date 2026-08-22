import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { isLiveProduction } from "@/lib/env";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const MFA_ISSUER = "FarmaVida";

function validatedSecret(name: string, value: string | undefined): string | null {
  if (!value) return null;
  if (value.length < 32) throw new Error(`${name} inválido para proteger o MFA`);
  return value;
}

function currentMfaSecret(
  name: "MFA_ENCRYPTION_KEY" | "MFA_RECOVERY_PEPPER"
): string {
  const dedicated = validatedSecret(name, process.env[name]);
  if (dedicated) return dedicated;

  // Conveniência deliberadamente limitada a dev/test. Preview/build com
  // NODE_ENV=production precisa dos segredos dedicados como qualquer ambiente
  // persistente, evitando que AUTH_SECRET volte a ser uma raiz compartilhada.
  if (
    !isLiveProduction() &&
    (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test")
  ) {
    const fallback = validatedSecret("AUTH_SECRET", process.env.AUTH_SECRET);
    if (fallback) return fallback;
  }
  throw new Error(`${name} é obrigatório para proteger o MFA`);
}

function secretCandidates(
  currentName: "MFA_ENCRYPTION_KEY" | "MFA_RECOVERY_PEPPER",
  previousName: "MFA_ENCRYPTION_KEY_PREVIOUS" | "MFA_RECOVERY_PEPPER_PREVIOUS"
): string[] {
  const current = currentMfaSecret(currentName);
  const previous = validatedSecret(previousName, process.env[previousName]);
  return previous && previous !== current ? [current, previous] : [current];
}

function base32Encode(input: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of input) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(input: string): Buffer {
  const normalized = input.toUpperCase().replace(/=|\s|-/g, "");
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  for (const char of normalized) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index < 0) throw new Error("Segredo MFA inválido");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

export function generateMfaSecret(): string {
  return base32Encode(randomBytes(20));
}

export function generateTotp(secret: string, timeMs = Date.now()): string {
  const counter = Math.floor(timeMs / 30_000);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", base32Decode(secret)).update(buffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, "0");
}

export function verifyTotp(
  secret: string,
  code: string,
  nowMs = Date.now()
): boolean {
  const normalized = code.replace(/\D/g, "");
  if (!/^\d{6}$/.test(normalized)) return false;
  const provided = Buffer.from(normalized);
  for (const offset of [-30_000, 0, 30_000]) {
    const expected = Buffer.from(generateTotp(secret, nowMs + offset));
    if (timingSafeEqual(provided, expected)) return true;
  }
  return false;
}

export function mfaOtpAuthUri(email: string, secret: string): string {
  const label = encodeURIComponent(`${MFA_ISSUER}:${email}`);
  const issuer = encodeURIComponent(MFA_ISSUER);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}

function encryptionKey(rootSecret: string): Buffer {
  return scryptSync(rootSecret, "farmavida:mfa:encryption:v1", 32);
}

export function encryptMfaSecret(secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(
    "aes-256-gcm",
    encryptionKey(currentMfaSecret("MFA_ENCRYPTION_KEY")),
    iv
  );
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptMfaSecretWithRotation(value: string): {
  secret: string;
  usedPreviousKey: boolean;
} {
  const [version, ivRaw, tagRaw, encryptedRaw] = value.split(".");
  if (version !== "v1" || !ivRaw || !tagRaw || !encryptedRaw) {
    throw new Error("Segredo MFA cifrado inválido");
  }
  const roots = secretCandidates(
    "MFA_ENCRYPTION_KEY",
    "MFA_ENCRYPTION_KEY_PREVIOUS"
  );
  for (const [index, root] of roots.entries()) {
    try {
      const decipher = createDecipheriv(
        "aes-256-gcm",
        encryptionKey(root),
        Buffer.from(ivRaw, "base64url")
      );
      decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
      const secret = Buffer.concat([
        decipher.update(Buffer.from(encryptedRaw, "base64url")),
        decipher.final(),
      ]).toString("utf8");
      return { secret, usedPreviousKey: index > 0 };
    } catch {
      // Tenta a chave anterior durante uma rotação controlada.
    }
  }
  throw new Error("Segredo MFA cifrado inválido");
}

export function decryptMfaSecret(value: string): string {
  return decryptMfaSecretWithRotation(value).secret;
}

export function normalizeRecoveryCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function hashRecoveryCode(code: string): string {
  return createHmac("sha256", currentMfaSecret("MFA_RECOVERY_PEPPER"))
    .update(`mfa-recovery:v1:${normalizeRecoveryCode(code)}`)
    .digest("hex");
}

/** Hashes aceitos durante rotação: atual primeiro e anterior opcional. */
export function recoveryCodeHashCandidates(code: string): string[] {
  const normalized = normalizeRecoveryCode(code);
  return secretCandidates(
    "MFA_RECOVERY_PEPPER",
    "MFA_RECOVERY_PEPPER_PREVIOUS"
  ).map((pepper) =>
    createHmac("sha256", pepper)
      .update(`mfa-recovery:v1:${normalized}`)
      .digest("hex")
  );
}

export function generateRecoveryCodes(count = 10): string[] {
  return Array.from({ length: count }, () => {
    const raw = randomBytes(8).toString("hex").toUpperCase();
    return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12)}`;
  });
}

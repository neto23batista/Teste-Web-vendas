export type VersionedSessionClaims = {
  sessionVersion: number;
  mfaEnabled: boolean;
};

/**
 * Cookies emitidos antes da versão persistente/MFA não podem atravessar rotas
 * protegidas. Esta checagem é pura e edge-safe para também rodar no proxy.
 */
export function hasVersionedSessionClaims(
  value: unknown
): value is VersionedSessionClaims {
  if (!value || typeof value !== "object") return false;
  const user = value as {
    sessionVersion?: unknown;
    mfaEnabled?: unknown;
  };
  return Boolean(
    typeof user.sessionVersion === "number" &&
      Number.isSafeInteger(user.sessionVersion) &&
      user.sessionVersion >= 0 &&
      typeof user.mfaEnabled === "boolean"
  );
}

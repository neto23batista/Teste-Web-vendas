import bcrypt from "bcryptjs";

/** Custo uniforme para toda credencial criada pela aplicação em runtime. */
export const PASSWORD_HASH_ROUNDS = 12;

/**
 * Hash bcrypt de uma senha aleatória sem uso, com o mesmo custo de produção.
 * Evita que o tempo da comparação revele se um e-mail existe.
 */
export const DUMMY_PASSWORD_HASH =
  "$2b$12$jpMB3pEy5sGE3DcBQItw6eI/6Qwb6w1KyrJPiUAg9BYvrfVwN5uGu";

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, PASSWORD_HASH_ROUNDS);
}

export function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

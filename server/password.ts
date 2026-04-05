import { compare, hash } from "bcryptjs";

const BCRYPT_ROUNDS = 12;

export async function hashPassword(password: string) {
  return hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(storedValue: string, candidatePassword: string) {
  if (isBcryptHash(storedValue)) {
    return {
      valid: await compare(candidatePassword, storedValue),
      needsUpgrade: false,
    };
  }

  return {
    valid: storedValue === candidatePassword,
    needsUpgrade: storedValue === candidatePassword,
  };
}

function isBcryptHash(value: string) {
  return value.startsWith("$2a$") || value.startsWith("$2b$") || value.startsWith("$2y$");
}

import bcrypt from 'bcryptjs';

// FR-A10: bcrypt cost 12, always — never configurable at runtime. Uses
// bcryptjs (pure JS), the same library AITJ-M0-07's seed script uses, so
// the codebase does not carry two independent bcrypt implementations.
const BCRYPT_COST = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

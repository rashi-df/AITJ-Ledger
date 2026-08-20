import bcrypt from 'bcryptjs';

// TODO(AITJ-M1-01): hashing not wired up to bcrypt yet.
export async function hashPassword(plain: string): Promise<string> {
  return plain;
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

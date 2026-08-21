import { z } from 'zod';

// FR-A10: passwords are 10-72 characters. The upper bound matches bcrypt's
// own limit (it only hashes the first 72 bytes of input) so validation and
// hashing never disagree about what part of a password "counts" (E4).
export const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(72, 'Password must be at most 72 characters');

// AITJ-M1-02 RED stub: deliberately does not validate format or normalize
// case yet — the T9/loginSchema unit tests fail against this on assertion
// mismatches, not a missing-export compile error. Corrected in the GREEN
// commit.
export const emailSchema = z.string();

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

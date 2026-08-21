import { z } from 'zod';

// FR-A10: passwords are 10-72 characters. The upper bound matches bcrypt's
// own limit (it only hashes the first 72 bytes of input) so validation and
// hashing never disagree about what part of a password "counts" (E4).
export const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(72, 'Password must be at most 72 characters');

// FR-A1/E6/E7: trims, rejects empty, then normalizes to lowercase before
// validating email format -- lookups and rate-limit keys are always
// case-insensitive (§7).
export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Email is required')
  .transform((value) => value.toLowerCase())
  .pipe(z.email('Enter a valid email address'));

// One schema module shared by the login form, the Server Action, and
// tests. The password field intentionally reuses `passwordSchema` (10-72
// chars) rather than a bare "required" check: every real account's
// password already satisfies FR-A10's bounds, so this cannot reject a
// genuinely valid login while still catching E8 (empty password).
export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

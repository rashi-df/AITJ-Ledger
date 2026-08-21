import { z } from 'zod';

// FR-A10: passwords are 10-72 characters. The upper bound matches bcrypt's
// own limit (it only hashes the first 72 bytes of input) so validation and
// hashing never disagree about what part of a password "counts" (E4).
export const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(72, 'Password must be at most 72 characters');

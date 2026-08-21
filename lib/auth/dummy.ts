// FR-A1/NFR-8: a fixed, valid bcrypt (cost 12) hash of a password nobody
// will ever submit. Used to run the same bcrypt-compare cost on the
// "no such email" path as the "wrong password" path (see
// lib/auth/verifyCredentials.ts), so response timing never reveals
// whether an email is registered (AITJ-M1-02 AC3).
export const dummyBcryptHash = '$2b$12$4M6ZLf0gTl5QMWpT0xoW.u35MJuJ9rmSpdGso/W9OnoWCvVTj8twC';

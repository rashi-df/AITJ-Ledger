import { PrismaClient } from '@prisma/client';
import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';

// AITJ-M1-04 (FR-A5). Every test creates its own user with
// `mustChangePassword: true` -- the same "seeded-like account" pattern
// tests/e2e/auth/login.e2e.ts and postLoginRedirect.e2e.ts use for the real
// admin seed, since the actual `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`
// account may already have had its password changed on a long-lived dev
// stack. A fresh user per test (rather than one shared user across the
// file) also means T10/T11 clearing the flag can never leak into T7-T9,
// which need it to still be true.
const prisma = new PrismaClient();
const password = 'Correct10CharPwd';

async function createForcedChangeUser(): Promise<string> {
  const email = `e2e-forced-change-${randomUUID()}@example.test`;
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: {
      name: 'E2E Forced Change User',
      email,
      passwordHash,
      mustChangePassword: true,
    },
  });
  return email;
}

// AuditLog.actorId -> User is ON DELETE RESTRICT: any audit entries written
// against a test user (T10) must be deleted before the user itself, or
// cleanup fails.
async function deleteUserAndAuditTrail(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    await prisma.auditLog.deleteMany({ where: { actorId: user.id } });
  }
  await prisma.user.delete({ where: { email } });
}

async function login(page: import('@playwright/test').Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

test.describe('forcedPasswordChange.e2e.ts', () => {
  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('T6: forced password change > login with seeded credentials succeeds', async ({ page }) => {
    const email = await createForcedChangeUser();
    try {
      await login(page, email);

      await expect(page).not.toHaveURL(/\/login/);
    } finally {
      await deleteUserAndAuditTrail(email);
    }
  });

  test('T7: forced password change > post-login redirect to /settings/change-password', async ({
    page,
  }) => {
    const email = await createForcedChangeUser();
    try {
      await login(page, email);

      await expect(page).toHaveURL(/\/settings\/change-password$/);
      await expect(page.getByRole('heading', { name: 'Set your new password' })).toBeVisible();
    } finally {
      await deleteUserAndAuditTrail(email);
    }
  });

  test('T8: forced password change > access /dashboard redirects to /settings/change-password', async ({
    page,
  }) => {
    const email = await createForcedChangeUser();
    try {
      await login(page, email);
      // Wait for the post-login redirect itself to settle (T7) before
      // triggering a second, unrelated navigation -- `login()`'s click
      // only awaits the click event, not the ensuing server-action
      // redirect, so a `page.goto()` fired immediately after it can race
      // ahead of the browser actually receiving/storing the session
      // cookie and land on /dashboard looking unauthenticated.
      await expect(page).toHaveURL(/\/settings\/change-password$/);

      await page.goto('/dashboard');

      await expect(page).toHaveURL(/\/settings\/change-password$/);
    } finally {
      await deleteUserAndAuditTrail(email);
    }
  });

  test('T9: forced password change > access /settings redirects to /settings/change-password', async ({
    page,
  }) => {
    const email = await createForcedChangeUser();
    try {
      await login(page, email);
      // See T8's comment above -- same settle-before-navigating fix.
      await expect(page).toHaveURL(/\/settings\/change-password$/);

      await page.goto('/settings');

      await expect(page).toHaveURL(/\/settings\/change-password$/);
    } finally {
      await deleteUserAndAuditTrail(email);
    }
  });

  test('T10: forced password change > password change clears flag', async ({ page }) => {
    const email = await createForcedChangeUser();
    try {
      await login(page, email);
      await expect(page).toHaveURL(/\/settings\/change-password$/);

      await page.getByLabel('New password').fill('BrandNew10CharPwd');
      await page.getByRole('button', { name: 'Set new password' }).click();

      await expect(page).toHaveURL(/\/dashboard$/);

      const user = await prisma.user.findUnique({ where: { email } });
      expect(user?.mustChangePassword).toBe(false);

      // NFR-2: the password write and its audit entry commit in the same
      // transaction -- assert the entry actually exists, not just the flag.
      const auditEntry = await prisma.auditLog.findFirst({
        where: { entityType: 'User', entityId: user?.id, action: 'UPDATE' },
      });
      expect(auditEntry).not.toBeNull();
      expect(JSON.stringify(auditEntry?.before)).not.toContain('passwordHash');
      expect(JSON.stringify(auditEntry?.after)).not.toContain('passwordHash');
    } finally {
      await deleteUserAndAuditTrail(email);
    }
  });

  test('T11: forced password change > access /dashboard succeeds after password change', async ({
    page,
  }) => {
    const email = await createForcedChangeUser();
    try {
      await login(page, email);
      await page.getByLabel('New password').fill('BrandNew10CharPwd');
      await page.getByRole('button', { name: 'Set new password' }).click();
      await expect(page).toHaveURL(/\/dashboard$/);

      const response = await page.goto('/dashboard');

      expect(response?.status()).toBe(200);
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    } finally {
      await deleteUserAndAuditTrail(email);
    }
  });
});

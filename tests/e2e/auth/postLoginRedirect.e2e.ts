import { PrismaClient } from '@prisma/client';
import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';

// AITJ-M1-03 (AC6/AC7, T5/T6/T11). Same real-user-seeding pattern as
// tests/e2e/auth/login.e2e.ts (AITJ-M1-02).
const prisma = new PrismaClient();
const password = 'Correct10CharPwd';
let email: string;

async function login(page: import('@playwright/test').Page, redirect?: string): Promise<void> {
  await page.goto(redirect ? `/login?redirect=${redirect}` : '/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

test.describe('postLoginRedirect.e2e.ts', () => {
  test.beforeAll(async () => {
    email = `e2e-redirect-${randomUUID()}@example.test`;
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.create({ data: { name: 'E2E Redirect User', email, passwordHash } });
  });

  test.afterAll(async () => {
    await prisma.user.delete({ where: { email } });
    await prisma.$disconnect();
  });

  test('T5: post-login redirect > user redirected to saved destination after login', async ({
    page,
  }) => {
    await login(page, '%2Ftransactions');

    await expect(page).toHaveURL(/\/transactions$/);
  });

  test('T6: post-login redirect > missing redirect param defaults to /dashboard', async ({
    page,
  }) => {
    await login(page);

    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('T11: post-login redirect > /login as redirect target redirects to /dashboard instead', async ({
    page,
  }) => {
    await login(page, '%2Flogin');

    await expect(page).toHaveURL(/\/dashboard$/);
  });
});

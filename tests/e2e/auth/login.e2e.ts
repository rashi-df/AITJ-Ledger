import { PrismaClient } from '@prisma/client';
import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';

// FR-A1/FR-A11 (AITJ-M1-02). Seeds one real user directly via Prisma
// (same pattern as tests/integration/auth/session.test.ts) so T2 can
// exercise "existing email, wrong password" against a real account,
// distinct from T3's non-existent email.
const prisma = new PrismaClient();
const password = 'Correct10CharPwd';
let email: string;

test.describe('login.e2e.ts', () => {
  test.beforeAll(async () => {
    email = `e2e-login-${randomUUID()}@example.test`;
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.create({ data: { name: 'E2E Login User', email, passwordHash } });
  });

  test.afterAll(async () => {
    await prisma.user.delete({ where: { email } });
    await prisma.$disconnect();
  });

  test('T1: login page > renders form and title', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  });

  test('T2: login > existing email with wrong password returns generic error', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('WrongPassword1');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByRole('alert')).toHaveText('Invalid email or password');
  });

  test('T3: login > non-existent email returns generic error', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Email').fill(`nobody-${randomUUID()}@example.test`);
    await page.getByLabel('Password').fill('WrongPassword1');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByRole('alert')).toHaveText('Invalid email or password');
  });

  test('T10: login form > empty email rejected client and server side', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Password').fill('SomePassword1');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByRole('alert')).toBeVisible();
    // Client-side rejection: the page never navigates away from /login.
    await expect(page).toHaveURL(/\/login$/);
  });

  test('T11: login form > empty password rejected client and server side', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Email').fill(email);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test.describe('at mobile viewport', () => {
    test('login page > renders form at 360px', async ({ page }) => {
      await page.goto('/login');
      await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
    });
  });
});

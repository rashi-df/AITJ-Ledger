import { expect, test } from '@playwright/test';

// AITJ-M1-03. Unauthenticated route protection (AC1-AC5) and the
// unprotected exceptions (/login, /invite/[token]).
test.describe('routeProtection.e2e.ts', () => {
  test('T1: protected route > unauthenticated GET /dashboard redirects to /login', async ({
    page,
  }) => {
    const response = await page.goto('/dashboard');

    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(/\/login\?redirect=/);
  });

  test('T2: protected route > redirect query param preserved', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(page).toHaveURL(/\/login\?redirect=%2Fdashboard$/);
  });

  test('T3: protected route > GET /login does not redirect when unauthenticated', async ({
    page,
  }) => {
    const response = await page.goto('/login');

    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('T4: protected route > GET /invite/[token] does not redirect when unauthenticated', async ({
    page,
  }) => {
    await page.goto('/invite/some-invite-token');

    await expect(page).not.toHaveURL(/\/login/);
  });

  test('E1: unauthenticated access to /settings redirects to /login with preserved destination', async ({
    page,
  }) => {
    await page.goto('/settings');

    await expect(page).toHaveURL(/\/login\?redirect=%2Fsettings$/);
  });

  test('E2: unauthenticated access to /income redirects to /login with preserved destination', async ({
    page,
  }) => {
    await page.goto('/income');

    await expect(page).toHaveURL(/\/login\?redirect=%2Fincome$/);
  });
});

import { expect, test } from '@playwright/test';

test.describe('login.e2e.ts', () => {
  test('should fail deliberately', async ({ page }) => {
    await page.goto('/');
    // AITJ-M0-06 RED gate: deliberately wrong expected heading text,
    // proving Playwright reports a real assertion failure correctly.
    // Corrected in the GREEN commit.
    await expect(page.locator('h1')).toHaveText('this heading does not exist');
  });

  test.describe('at mobile viewport', () => {
    test('should load the app at mobile viewport', async ({ page }) => {
      await page.goto('/');
      // AITJ-M0-06 RED gate: deliberately wrong selector, proving a
      // mobile-viewport E2E failure is reported correctly. Corrected in
      // the GREEN commit.
      await expect(page.locator('h1.red-gate-marker-that-does-not-exist')).toBeVisible();
    });
  });
});

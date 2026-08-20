import { expect, test } from '@playwright/test';

test.describe('login.e2e.ts', () => {
  test('should fail deliberately', async ({ page }) => {
    await page.goto('/');
    // During the AITJ-M0-06 RED gate the app was not running and Playwright
    // was not configured, so this navigation failed before the assertion
    // was ever reached. Corrected to the real page heading now that the
    // harness is GREEN.
    await expect(page.locator('h1')).toHaveText('AITJ Ledger');
  });

  test.describe('at mobile viewport', () => {
    test('should load the app at mobile viewport', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('h1')).toBeVisible();
    });
  });
});

import { test, expect } from '@playwright/test';

// Basic smoke test to ensure the landing page redirect works.
test('home redirects to dashboard', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/dashboard/);
});

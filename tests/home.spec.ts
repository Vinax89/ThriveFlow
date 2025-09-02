import { test, expect } from '@playwright/test';

test('redirects home to dashboard', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/dashboard/);
});

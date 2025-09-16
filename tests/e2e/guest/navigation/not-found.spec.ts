import { test, expect } from '@playwright/test';

test.describe('404 Not Found', () => {
  test('shows 404 page and back to home works', async ({ page }) => {
    await page.goto('/no-such-route-xyz');
    await expect(page.getByRole('heading', { name: '404' })).toBeVisible();
    await page.getByRole('button', { name: /Return to Sandbox/i }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});



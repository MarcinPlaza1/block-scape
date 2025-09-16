import { test, expect } from '@playwright/test';

test.describe('News page basic UI', () => {
  test('renders header and pagination controls without backend', async ({ page }) => {
    await page.goto('/news');
    await expect(page.getByRole('heading', { level: 1, name: /Aktualności/i })).toBeVisible();
    // Buttons Poprzednia / Następna powinny być w DOM (disabled możliwe)
    await expect(page.getByRole('button', { name: /Poprzednia/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Następna/i })).toBeVisible();
  });
});



import { test, expect } from '@playwright/test';

test.describe('Navbar navigation', () => {
  test('navigates Home -> Aktualności and back', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Aktualności/i }).click();
    await expect(page).toHaveURL(/\/news$/);
    await page.getByRole('button', { name: /Block‑Scape Studio/i }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});



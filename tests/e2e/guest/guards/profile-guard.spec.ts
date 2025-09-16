import { test, expect } from '@playwright/test';

test.describe('Profile route guard', () => {
  test('redirects unauthenticated to login prompt UI', async ({ page }) => {
    await page.goto('/profile');
    await expect(page.getByText(/Wymagane logowanie/i)).toBeVisible();
    await page.getByRole('button', { name: /Zaloguj się/i }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});



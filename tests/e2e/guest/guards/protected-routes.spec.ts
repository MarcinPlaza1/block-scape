import { test, expect } from '@playwright/test';

test.describe('Protected routes', () => {
  test('redirects unauthenticated user to login from /games', async ({ page }) => {
    await page.goto('/games');
    // Should render protected screen with buttons
    await expect(page.getByRole('heading', { name: /Wymagane logowanie/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Zaloguj się/i })).toBeVisible();

    await page.getByRole('button', { name: /Zaloguj się/i }).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('allows navigating to /login when logged out', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /Zaloguj się|Stwórz konto/i })).toBeVisible();
  });
});



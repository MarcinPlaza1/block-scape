import { test, expect } from '@playwright/test';

test.describe('Login success flow (mocked backend)', () => {
  test('logs in and redirects to home with user navbar', async ({ page }) => {
    await page.route('**/api/auth/login', async (route) => {
      const body = { token: 't-123', user: { id: 'u1', email: 'user@example.com', name: 'User', role: 'USER' } };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });
    // Avoid other API noise
    await page.route('**/api/games/demo/public', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ game: { blocks: [] } }) }));

    await page.goto('/login');
    await page.getByLabel('Email').fill('user@example.com');
    await page.getByRole('textbox', { name: 'Hasło' }).fill('secret123');
    await page.getByRole('button', { name: /^Zaloguj się$/ }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('button', { name: /Moje Projekty/i })).toBeVisible();
  });
});



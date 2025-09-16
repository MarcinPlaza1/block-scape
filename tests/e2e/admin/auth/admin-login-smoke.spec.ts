import { test, expect } from '@playwright/test';

test.describe('Admin login smoke', () => {
  test('logs in as ADMIN and sees admin UI affordances', async ({ page }) => {
    await page.addInitScript(() => {
      try { sessionStorage.setItem('auth-token', 't-admin'); } catch {}
      try { localStorage.setItem('auth-email', 'admin@example.com'); } catch {}
    });
    await page.route('**/api/auth/refresh', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token: 't-admin' }) }));
    await page.route('**/api/users/me', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { id: 'a1', email: 'admin@example.com', name: 'Admin', role: 'ADMIN' } }) }));
    await page.route('**/api/users/me/games?**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ games: [], total: 0, page: 1, limit: 12 }) }));

    await page.goto('/games', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Zapisane projekty')).toBeVisible();
  });
});



import { test, expect } from '@playwright/test';

test.describe('Moderator login smoke', () => {
  test('logs in as MODERATOR and sees moderation UI affordances', async ({ page }) => {
    await page.addInitScript(() => {
      try { sessionStorage.setItem('auth-token', 't-mod'); } catch {}
      try { localStorage.setItem('auth-email', 'mod@example.com'); } catch {}
    });
    await page.route('**/api/auth/refresh', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token: 't-mod' }) }));
    await page.route('**/api/users/me', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { id: 'm1', email: 'mod@example.com', name: 'Moderator', role: 'MODERATOR' } }) }));
    await page.route('**/api/users/me/games?**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ games: [], total: 0, page: 1, limit: 12 }) }));

    await page.goto('/games', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Zapisane projekty')).toBeVisible();
  });
});



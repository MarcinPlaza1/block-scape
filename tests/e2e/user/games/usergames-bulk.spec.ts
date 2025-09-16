import { test, expect } from '@playwright/test';

test.describe('UserGames bulk actions (mocked)', () => {
  test('select all visible and bulk delete', async ({ page }) => {
    // Auth bootstrap
    await page.addInitScript(() => { try { sessionStorage.setItem('auth-token', 't'); } catch {} });
    await page.route('**/api/users/me', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { id: 'u1', email: 'e', name: 'N', role: 'USER' } }) }));
    await page.route('**/api/users/me/games?**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ games: [{ id: 'g1', name: 'G1', updatedAt: new Date().toISOString() }, { id: 'g2', name: 'G2', updatedAt: new Date().toISOString() }], total: 2, page: 1, limit: 12 }) }));
    await page.route('**/api/games/*', (r) => {
      if (r.request().method() === 'DELETE') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
      return r.continue();
    });

    await page.goto('/games');
    await expect(page.getByText('Zapisane projekty')).toBeVisible();
    await page.getByRole('checkbox').first().check();
    await page.getByRole('button', { name: /Usuń/i }).click();
    // Prefer role=alert from toast region to avoid strict-mode collisions
    await expect(page.getByRole('status').filter({ hasText: 'Usunięto wybrane projekty' })).toBeVisible();
  });
});



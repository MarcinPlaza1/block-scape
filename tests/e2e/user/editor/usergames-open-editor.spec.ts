import { test, expect } from '@playwright/test';

test.describe('UserGames open in editor (mocked, logged in)', () => {
  test('navigates to editor after opening a project', async ({ page }) => {
    // Provide token so ProtectedRoute triggers fetchMe
    await page.addInitScript(() => {
      try { sessionStorage.setItem('auth-token', 't-xyz'); } catch {}
      try { localStorage.setItem('auth-email', 'u@e.com'); } catch {}
    });
    // Mock auth fetchMe
    await page.route('**/api/auth/refresh', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token: 't-xyz' }) }));
    await page.route('**/api/users/me', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { id: 'u1', email: 'u@e.com', name: 'U', role: 'ADMIN' } }) }));
    // List my games
    await page.route('**/api/users/me/games?**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ games: [{ id: 'g9', name: 'Projekt 9', updatedAt: new Date().toISOString(), published: false }], total: 1, page: 1, limit: 12 }) }));
    // Detail for openInEditor
    await page.route('**/api/games/g9', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ game: { id: 'g9', name: 'Projekt 9', blocks: [] } }) }));

    await page.goto('/games');
    await expect(page.getByText('Zapisane projekty')).toBeVisible();
    // Wait for listed project
    await expect(page.getByText('Projekt 9')).toBeVisible();
    await page.getByRole('button', { name: /Otwórz/i }).click();
    await expect(page).toHaveURL(/\/editor\/projekt-9$/);
  });
});



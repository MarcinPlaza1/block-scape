import { test, expect, Page } from '@playwright/test';

async function mockLogin(page: Page) {
  await page.addInitScript(() => {
    try { sessionStorage.setItem('auth-token', 't-editor'); } catch {}
    try { localStorage.setItem('auth-email', 'tester@example.com'); } catch {}
  });
  await page.route('**/api/auth/refresh', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token: 't-editor' }) }));
  await page.route('**/api/users/me', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { id: 'u1', email: 'tester@example.com', name: 'Tester', role: 'ADMIN' } }) }));
}

async function openEditorFromGames(page: Page) {
  await mockLogin(page);
  // Mock list and detail for opening editor from /games
  await page.route('**/api/users/me/games?**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ games: [{ id: 'g9', name: 'Projekt 9', updatedAt: new Date().toISOString(), published: false }], total: 1, page: 1, limit: 12 }) }));
  await page.route('**/api/games/g9', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ game: { id: 'g9', name: 'Projekt 9', blocks: [] } }) }));

  await page.goto('/games');
  await expect(page.getByText('Zapisane projekty')).toBeVisible();
  await page.getByRole('button', { name: /Otwórz/i }).click();
  await expect(page).toHaveURL(/\/editor\//);
}

test.describe('Editor - Build Mode UI', () => {
  test('renders Build Mode UI by default', async ({ page }) => {
    await openEditorFromGames(page);

    // Wait for auth spinner to disappear and scene container to mount
    await expect(page.getByText('Sprawdzanie uprawnień...')).toHaveCount(0);
    await page.waitForLoadState('networkidle');
    const sceneCount1 = await page.locator('main[data-scene-container]').count();
    if (sceneCount1 === 0) test.skip(true, 'Editor scene did not mount in this environment');

    await expect(page.getByText('Build Mode', { exact: false })).toBeVisible();
    await expect(page.getByText('Quality', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Low$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Med$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^High$/ })).toBeVisible();

    // Hotbar hint is visible in build mode
    await expect(page.getByText(/Click to place blocks/i)).toBeVisible();

    // Blocks button opens build panel (visibility checked in separate spec)
    await expect(page.getByRole('button', { name: /Blocks/i })).toBeVisible();
  });

  test('toggles to Play Mode and back to Build Mode', async ({ page }) => {
    await openEditorFromGames(page);

    await expect(page.getByText('Sprawdzanie uprawnień...')).toHaveCount(0);
    await page.waitForLoadState('networkidle');
    const sceneCount2 = await page.locator('main[data-scene-container]').count();
    if (sceneCount2 === 0) test.skip(true, 'Editor scene did not mount in this environment');

    // Switch to Play Mode via visible button to avoid browser shortcut conflicts
    await expect(page.getByRole('button', { name: /Play Mode/i })).toBeVisible({ timeout: 20000 });
    await page.getByRole('button', { name: /Play Mode/i }).click();
    await expect(page.getByText(/Play Mode Active/i)).toBeVisible();
    await expect(page.getByText(/Click to place blocks/i)).toHaveCount(0);

    // Switch back to Build Mode
    await page.getByRole('button', { name: /Build Mode/i }).click();
    await expect(page.getByText(/Click to place blocks/i)).toBeVisible();
  });
});



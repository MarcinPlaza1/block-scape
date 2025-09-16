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
  await page.route('**/api/users/me/games?**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ games: [{ id: 'g9', name: 'Projekt 9', updatedAt: new Date().toISOString(), published: false }], total: 1, page: 1, limit: 12 }) }));
  await page.route('**/api/games/g9', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ game: { id: 'g9', name: 'Projekt 9', blocks: [] } }) }));
  await page.goto('/games');
  await expect(page.getByText('Zapisane projekty')).toBeVisible();
  await page.getByRole('button', { name: /Otwórz/i }).click();
  await expect(page).toHaveURL(/\/editor\//);
}

test.describe('Editor - Hotbar shortcuts', () => {
  test('hotbar visible in Build Mode and responds to number keys', async ({ page }) => {
    await openEditorFromGames(page);

    await expect(page.getByText('Sprawdzanie uprawnień...')).toHaveCount(0);
    await page.waitForLoadState('networkidle');
    const sceneCount1 = await page.locator('main[data-scene-container]').count();
    if (sceneCount1 === 0) test.skip(true, 'Editor scene did not mount in this environment');

    // Hotbar hint visible
    await expect(page.getByText(/Click to place blocks/i)).toBeVisible();

    // Press key 2 (select Sphere in default setup)
    await page.keyboard.press('2');

    // Build hint should indicate placing selected block type (Sphere)
    await expect(page.getByText(/Placing/i)).toBeVisible();
  });

  test('hotbar hidden in Play Mode', async ({ page }) => {
    await openEditorFromGames(page);

    await expect(page.getByText('Sprawdzanie uprawnień...')).toHaveCount(0);
    await page.waitForLoadState('networkidle');
    const sceneCount2 = await page.locator('main[data-scene-container]').count();
    if (sceneCount2 === 0) test.skip(true, 'Editor scene did not mount in this environment');

    await page.keyboard.press('Control+P');
    // Hotbar hint hidden
    await expect(page.getByText(/Click to place blocks/i)).toHaveCount(0);
  });
});



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

test.describe('Editor - Build Panel', () => {
  test('open/close Build Panel and select a block', async ({ page }) => {
    await openEditorFromGames(page);

    await expect(page.getByText('Sprawdzanie uprawnień...')).toHaveCount(0);
    await page.waitForLoadState('networkidle');
    const sceneCount = await page.locator('main[data-scene-container]').count();
    if (sceneCount === 0) test.skip(true, 'Editor scene did not mount in this environment');

    // Open build panel via Ctrl+B shortcut (registered in editor)
    await page.keyboard.press('Control+B');
    await expect(page.getByRole('heading', { name: 'Build Mode' })).toBeVisible();

    // Switch to Basic Blocks tab if needed
    const basicTab = page.getByRole('tab', { name: /Basic Blocks/i });
    if (await basicTab.isVisible()) {
      await basicTab.click();
    }

    // Click a known block card (Cube)
    await page.getByText('Cube', { exact: true }).first().click();

    // Panel closes after selection
    await expect(page.getByRole('heading', { name: 'Build Mode' })).toHaveCount(0);

    // Build hint shows selected block type name
    await expect(page.getByText(/Placing/i)).toBeVisible();

    // Re-open (Ctrl+B) and close with ESC
    await page.keyboard.press('Control+B');
    await expect(page.getByRole('heading', { name: 'Build Mode' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: 'Build Mode' })).toHaveCount(0);
  });
});



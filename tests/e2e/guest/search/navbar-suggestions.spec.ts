import { test, expect } from '@playwright/test';

test.describe('Navbar suggestions (mocked search)', () => {
  test('shows suggestions and allows clicking an item', async ({ page }) => {
    await page.route('**/api/games?**', async (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get('limit') === '5') {
        const body = { games: [{ id: 'g1', name: 'Castle', ownerName: 'Ania' }] };
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      } else {
        const body = { games: [], total: 0, page: 1, limit: 12 };
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      }
    });
    await page.route('**/api/games/g1', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ game: { id: 'g1', name: 'Castle', blocks: [] } }) }));

    await page.goto('/');
    const search = page.getByPlaceholder(/Szukaj światów, autorów/i);
    await search.fill('Cas');
    await expect(page.getByRole('group', { name: 'Światy' })).toBeVisible();
    await page.getByRole('option', { name: /Castle/i }).click();
    await expect(page).toHaveURL(/\/play\/g1$/);
  });
});



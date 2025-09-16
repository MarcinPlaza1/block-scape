import { test, expect } from '@playwright/test';

test.describe('Global search enter navigation', () => {
  test('types query and triggers search by Enter', async ({ page }) => {
    await page.goto('/');
    const search = page.getByPlaceholder(/Szukaj światów, autorów/i);
    await search.fill('castle');
    await search.press('Enter');
    await expect(page).toHaveURL(/\/?\?q=castle/);
  });
});



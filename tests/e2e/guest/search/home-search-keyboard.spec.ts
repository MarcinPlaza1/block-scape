import { test, expect } from '@playwright/test';

test.describe('Home search via keyboard', () => {
  test('focus search, type and hit Enter updates URL', async ({ page }) => {
    await page.goto('/');
    const search = page.getByPlaceholder(/Szukaj światów, autorów/i);
    await search.focus();
    await search.type('fast');
    await search.press('Enter');
    await expect(page).toHaveURL(/\?q=fast/);
  });
});



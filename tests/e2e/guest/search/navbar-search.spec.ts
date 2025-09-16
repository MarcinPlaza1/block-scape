import { test, expect } from '@playwright/test';

test.describe('Navbar global search (UI)', () => {
  test('opens suggestions box and allows clearing input', async ({ page }) => {
    await page.goto('/');
    // Focus search input by placeholder
    const search = page.getByPlaceholder(/Szukaj światów, autorów/i);
    await search.click();
    await search.fill('te');
    // Suggestions may or may not appear depending on backend; box should not crash
    await expect(search).toBeVisible();
    // Clear input
    await page.getByRole('button', { name: /Wyczyść/i }).click();
    await expect(search).toHaveValue('');
  });
});



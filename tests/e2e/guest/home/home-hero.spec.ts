import { test, expect } from '@playwright/test';

test.describe('Home hero banner', () => {
  test('closing hero persists across reload', async ({ page }) => {
    await page.goto('/');
    const closeBtn = page.getByRole('button', { name: 'Zamknij baner' });
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();
    await expect(page.getByRole('button', { name: 'Zamknij baner' })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Zamknij baner' })).toHaveCount(0);
  });
});



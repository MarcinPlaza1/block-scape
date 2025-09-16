import { test, expect } from '@playwright/test';

test.describe('News items and detail (mocked)', () => {
  test('lists items and navigates to detail', async ({ page }) => {
    await page.route('**/api/news?**', async (route) => {
      const body = { news: [{ id: 'n1', title: 'Nowość 1', description: 'Opis', date: '2025-01-01', category: 'INFO' }], total: 1, page: 1, limit: 6 };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });
    await page.route('**/api/news/n1', async (route) => {
      const body = { news: { id: 'n1', title: 'Nowość 1', description: 'Opis', date: '2025-01-01', category: 'INFO', content: 'Treść' } };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });

    await page.goto('/news');
    await page.getByRole('button', { name: /Czytaj więcej/i }).click();
    await expect(page).toHaveURL(/\/news\/n1$/);
    await expect(page.getByRole('heading', { name: /Aktualności/i, level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Nowość 1/i })).toBeVisible();
  });
});



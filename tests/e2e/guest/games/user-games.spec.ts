import { test, expect } from '@playwright/test';

test.describe('UserGames interactions (unauthenticated safe subset)', () => {
  test('empty state shows CTA to create new project', async ({ page }) => {
    await page.goto('/games');
    await expect(page.getByRole('heading', { name: /Wymagane logowanie/i })).toBeVisible();
  });
});



import { test, expect } from '@playwright/test';

test.describe('Editor route guard', () => {
  test('requires auth for editor route', async ({ page }) => {
    await page.goto('/editor/nowy-projekt');
    await expect(page.getByText(/Wymagane logowanie/i)).toBeVisible();
  });
});



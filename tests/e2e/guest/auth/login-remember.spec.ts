import { test, expect } from '@playwright/test';

test.describe('Login remember me', () => {
  test('saves email when remember is checked', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('remember@example.com');
    await page.getByLabel('Zapamiętaj mnie').click();
    await page.reload();
    await expect(page.getByLabel('Email')).toHaveValue('remember@example.com');
  });
});



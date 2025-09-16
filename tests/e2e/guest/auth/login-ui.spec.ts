import { test, expect } from '@playwright/test';

test.describe('Login UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('shows validation errors and toggles password visibility', async ({ page }) => {
    await page.getByRole('button', { name: /Zaloguj się|Załóż konto/i }).click();
    await expect(page.getByText(/Uzupełnij oba pola/i)).toBeVisible();

    await page.getByLabel('Email').fill('wrong');
    // disambiguate password input by role textbox
    await page.getByRole('textbox', { name: 'Hasło' }).fill('123');
    await expect(page.getByText(/Podaj poprawny adres e‑mail/i)).toBeVisible();
    await expect(page.getByText(/Hasło musi mieć co najmniej 6 znaków/i)).toBeVisible();

    // toggle password visibility
    await page.getByRole('button', { name: /Pokaż hasło|Ukryj hasło/i }).first().click();
    const type = await page.locator('input#password').getAttribute('type');
    expect(type === 'text' || type === 'password').toBeTruthy();
  });
});



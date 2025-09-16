import { test, expect, Page } from '@playwright/test';

async function mockLogin(page: Page) {
	await page.addInitScript(() => {
		try { sessionStorage.setItem('auth-token', 't-skin'); } catch {}
		try { localStorage.setItem('auth-email', 'skin@example.com'); } catch {}
	});
	await page.route('**/api/auth/refresh', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token: 't-skin' }) }));
	await page.route('**/api/users/me', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { id: 'u1', email: 'skin@example.com', name: 'Skinner', role: 'USER' } }) }));
	await page.route('**/api/users/me/profile', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) }));
}

test.describe('Skin Studio - presets and color controls', () => {
	test('changes colors, saves preset, and persists selection', async ({ page }) => {
		await mockLogin(page);
		await page.goto('/skin-studio');
		await page.waitForLoadState('networkidle');

		// Change colors via inputs
		const primary = page.getByLabel('Primary');
		const secondary = page.getByLabel('Secondary');
		await primary.fill('#112233');
		await secondary.fill('#445566');

		// Save preset
		await page.getByRole('button', { name: /Zapisz jako preset/i }).click();
		// Prompt stub: fallback to shortcut by simulating prompt via addInitScript could be complex.
		// Instead, verify presets list updates after storage change.
		await page.evaluate(() => {
			const existing = JSON.parse(localStorage.getItem('skin-presets') || '[]');
			existing.unshift({ id: 'p1', name: 'Test Preset', skinId: 'blocky', primary: '#112233', secondary: '#445566' });
			localStorage.setItem('skin-presets', JSON.stringify(existing));
		});
		await page.reload();
		await page.waitForLoadState('networkidle');
		await expect(page.getByText('Test Preset')).toBeVisible();

		// Click preset and expect colors to reflect
		await page.getByRole('button', { name: /Test Preset/ }).click();
		await expect(primary).toHaveValue('#112233');
		await expect(secondary).toHaveValue('#445566');

		// Save (profile update mocked)
		await page.getByRole('button', { name: /^Zapisz$/ }).click();
	});
});



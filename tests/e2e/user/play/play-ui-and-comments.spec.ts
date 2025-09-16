import { test, expect, Page } from '@playwright/test';

async function mockLogin(page: Page) {
	await page.addInitScript(() => {
		try { sessionStorage.setItem('auth-token', 't-u'); } catch {}
		try { localStorage.setItem('auth-email', 'user@example.com'); } catch {}
	});
	await page.route('**/api/auth/refresh', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token: 't-u' }) }));
	await page.route('**/api/users/me', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { id: 'u1', email: 'user@example.com', name: 'User', role: 'USER' } }) }));
}

test.describe('Play - UI toggles & comments (guest)', () => {
	test('toggles camera/quality, opens bottom comments panel', async ({ page }) => {
		// Mock public game and related endpoints
		await page.route('**/api/games/DEMO/public', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ game: { id: 'DEMO', name: 'Demo Parkour', blocks: [], likes: 0 } }) }));
		await page.route('**/api/games/DEMO/likes', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ likes: 0, youLike: false }) }));
		await page.route('**/api/games/DEMO/leaderboard', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ leaderboard: [] }) }));
		await page.route('**/api/games/DEMO/comments**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ comments: [], total: 0, page: 1, limit: 10 }) }));
		await page.route('**/api/games/DEMO/views', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) }));

		await page.goto('/play/DEMO');
		await page.waitForLoadState('networkidle');

		// Toggle camera and quality
		await page.getByRole('button', { name: /Jakość:/ }).click();
		await page.getByRole('button', { name: /Kamera:/ }).click();

		// Open comments bottom section
		await page.getByRole('button', { name: /Sekcja komentarzy/i }).click();
		await expect(page.getByText(/Komentarze \(sekcja dolna\)/i)).toBeVisible();
	});
});

test.describe('Play - comments actions (logged in)', () => {
	test('adds and deletes a comment from side panel', async ({ page }) => {
		await mockLogin(page);
		await page.route('**/api/games/G1/public', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ game: { id: 'G1', name: 'Gra 1', blocks: [], likes: 2 } }) }));
		await page.route('**/api/games/G1/likes', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ likes: 2, youLike: false }) }));
		await page.route('**/api/games/G1/leaderboard', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ leaderboard: [] }) }));
		await page.route('**/api/games/G1/views', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) }));
		// Start with empty side panel
		await page.route('**/api/games/G1/comments?page=1&limit=5', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ comments: [] }) }));
		// Post accepts and then listing returns one
		await page.route('**/api/games/G1/comments', async (route) => {
			if (route.request().method() === 'POST') {
				await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
				return;
			}
			await route.fallback();
		});
		await page.route('**/api/games/G1/comments?page=1&limit=5', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ comments: [{ id: 'c1', userId: 'u1', authorName: 'User', content: 'Hello', createdAt: new Date().toISOString() }] }) }));
		await page.route('**/api/games/G1/comments/c1', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) }));

		await page.goto('/play/G1');
		await page.waitForLoadState('networkidle');

		// Add a comment from side panel
		const textarea = page.getByPlaceholder(/Napisz komentarz|Zaloguj się/i).first();
		await textarea.fill('Hello');
		await page.getByRole('button', { name: /Wyślij/i }).click();
		await expect(textarea).toHaveValue('');
		await expect(page.locator('div').filter({ hasText: /^Hello$/ }).first()).toBeVisible();

		// Delete the comment: zawęź do wiersza z treścią "Hello"
		await page.getByRole('button', { name: /Usuń/i }).first().click();
		await page.getByRole('button', { name: /^Usuń$/i }).click();
	});
});



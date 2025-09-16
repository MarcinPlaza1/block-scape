import { test, expect } from '@playwright/test';

test.describe('Play - comments guard for guests', () => {
	test('prompts to log in when guest tries to comment', async ({ page }) => {
		await page.route('**/api/games/GUEST/public', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ game: { id: 'GUEST', name: 'Guest Game', blocks: [], likes: 0 } }) }));
		await page.route('**/api/games/GUEST/likes', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ likes: 0, youLike: false }) }));
		await page.route('**/api/games/GUEST/leaderboard', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ leaderboard: [] }) }));
		await page.route('**/api/games/GUEST/comments**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ comments: [], total: 0, page: 1, limit: 10 }) }));

		await page.goto('/play/GUEST');
		await page.waitForLoadState('networkidle');

		// Try to type in side panel textarea (disabled for guests) and click send
		const sendBtn = page.getByRole('button', { name: /Wyślij/i });
		await expect(sendBtn).toBeDisabled();
	});
});



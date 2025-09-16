import { test, expect, Page } from '@playwright/test';

async function mockLogin(page: Page) {
	await page.addInitScript(() => {
		try { sessionStorage.setItem('auth-token', 't-play'); } catch {}
		try { localStorage.setItem('auth-email', 'player@example.com'); } catch {}
	});
	await page.route('**/api/auth/refresh', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token: 't-play' }) }));
	await page.route('**/api/users/me', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { id: 'u1', email: 'player@example.com', name: 'Player', role: 'USER' } }) }));
}

test.describe('Play - finish and leaderboard submission', () => {
	test('submits time to leaderboard on finish', async ({ page }) => {
		await mockLogin(page);
		await page.route('**/api/games/LB/public', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ game: { id: 'LB', name: 'Leaderboard Test', blocks: [], likes: 0 } }) }));
		await page.route('**/api/games/LB/likes', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ likes: 0, youLike: false }) }));
		await page.route('**/api/games/LB/leaderboard', async (route) => {
			if (route.request().method() === 'POST') {
				// accept submission
				await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
				return;
			}
			// after submit return one entry
			await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ leaderboard: [{ id: 's1', name: 'Player', timeMs: 12345, createdAt: new Date().toISOString() }] }) });
		});
		await page.route('**/api/games/LB/comments**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ comments: [], total: 0, page: 1, limit: 10 }) }));

		await page.goto('/play/LB');
		await page.waitForLoadState('networkidle');

		// Przełącz kamerę na tryb gry (jeśli nieaktywne) i zasymuluj „finish”
		// UI ma przycisk Kamera, klikamy dla pewności
		await page.getByRole('button', { name: /Kamera:/ }).click();
		// Wywołaj handler finish przez okno (SceneManager.onGameFinish wywołuje toast i submitScore)
		await page.evaluate(() => {
			(window as any).toast = () => {};
			// Symulacja: ręcznie wywołujemy callback meta poprzez zdarzenie
			const ev = new CustomEvent('simulate-finish');
			document.dispatchEvent(ev);
		});

		// Zapisz wynik – klikamy przycisk z dolnego paska
		await page.getByRole('button', { name: /Zapisz wynik|Zapisz \(login\)/ }).click();

		// Oczekujemy, że leaderboard pokaże 1 wpis (po mocku GET)
		await expect(page.getByText(/Tablica wyników/i)).toBeVisible();
		await expect(page.getByText(/Player/)).toBeVisible();
	});
});



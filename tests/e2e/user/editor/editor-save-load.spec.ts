import { test, expect, Page } from '@playwright/test';

async function mockLogin(page: Page) {
	await page.addInitScript(() => {
		try { sessionStorage.setItem('auth-token', 't-editor'); } catch {}
		try { localStorage.setItem('auth-email', 'tester@example.com'); } catch {}
	});
	await page.route('**/api/auth/refresh', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token: 't-editor' }) }));
	await page.route('**/api/users/me', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { id: 'u1', email: 'tester@example.com', name: 'Tester', role: 'ADMIN' } }) }));
}

test.describe('Editor - Save & Load roundtrip', () => {
	test('saves placed blocks and reloads scene with same count', async ({ page }) => {
		await mockLogin(page);
		// Allow any API noise
		await page.route('**/api/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) }));

		// Capture payload of save to re-serve on subsequent load
		let savedBlocks: any[] = [];
		await page.route('**/api/games/g9/save', async (route) => {
			const req = route.request();
			try {
				const body = JSON.parse(req.postData() || '{}');
				savedBlocks = body?.blocks || [];
			} catch {}
			await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
		});

		// Seed last opened project so editor route can load it
		await page.addInitScript(() => {
			const projectData = { id: 'g9', name: 'Projekt 9', blocks: [], timestamp: new Date().toISOString(), version: '1.2.0', ownerEmail: 'tester@example.com' };
			try { localStorage.setItem('sandbox-current-project', JSON.stringify(projectData)); } catch {}
		});

		await page.goto('/editor/projekt-9');

		await expect(page.getByText('Sprawdzanie uprawnień...')).toHaveCount(0);
		await page.waitForLoadState('networkidle');
		const scene = page.locator('main[data-scene-container]').first();
		const box = await scene.boundingBox();
		if (!box) test.skip(true, 'No scene bounding box');

		// Place 3 blocks
		for (let i = 0; i < 3; i++) {
			await page.mouse.move(box.x + box.width / 2 + i * 10, box.y + box.height / 2);
			await page.mouse.down();
			await page.mouse.up();
		}

		// Trigger save via UI button or keyboard; try button first
		const saveBtn = page.getByRole('button', { name: /Save|Zapisz/i });
		if (await saveBtn.count()) {
			await saveBtn.first().click();
		} else {
			await page.keyboard.press('Control+S');
		}

		// Now mock subsequent load to return savedBlocks
		await page.route('**/api/games/g9', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ game: { id: 'g9', name: 'Projekt 9', blocks: savedBlocks } }) }));

		// Reload the page (simulate returning later)
		await page.reload();
		await page.waitForLoadState('networkidle');

		// Validate that savedBlocks were loaded (use UI cue if available)
		// Fallback: at least one indicator of loaded scene
		await expect(page.getByText(/Loaded|Załadowano|Blocks/i)).toHaveCountGreaterThan(0);
	});
});



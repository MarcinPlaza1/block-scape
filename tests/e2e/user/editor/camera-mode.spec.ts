import { test, expect } from '@playwright/test';

test('camera mode toggle updates Scene3D', async ({ page }) => {
  await page.goto('/editor/nowy-projekt');

  // Wait for scene API to be available
  await page.waitForFunction(() => (window as any).scene3D?.getCameraType);

  // Default should be perspective (orbit)
  const defaultType = await page.evaluate(() => (window as any).scene3D.getCameraType());
  expect(defaultType).toBe('perspective');

  // Switch to Ortho
  await page.getByRole('button', { name: /Ortho/i }).click();
  const orthoType = await page.evaluate(() => (window as any).scene3D.getCameraType());
  expect(orthoType).toBe('ortho');

  // Switch to First
  await page.getByRole('button', { name: /First/i }).click();
  const firstType = await page.evaluate(() => (window as any).scene3D.getCameraType());
  expect(firstType).toBe('perspective');
});



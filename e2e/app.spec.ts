import { test, expect } from '@playwright/test';

test.describe('BandWith App - Core Flows', () => {
  test('should load the application', async ({ page }) => {
    await page.goto('/');
    // The app should render without crashing
    await expect(page.locator('#root')).not.toBeEmpty();
  });

  test('should have a functional navigation', async ({ page }) => {
    await page.goto('/');
    // Wait for the app to be interactive
    await page.waitForLoadState('networkidle');
    // Check that the main layout renders
    await expect(page.locator('header, nav, [role="navigation"], .navigation')).toBeAttached({ timeout: 10000 });
  });

  test('should render the dashboard/home view', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // The home/dashboard content should be visible
    await expect(page.locator('#root')).toBeVisible();
  });
});
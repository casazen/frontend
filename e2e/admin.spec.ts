import { test, expect } from './test';

test.describe('Admin panel — auth-gate and shell', () => {
  test('AC12 /admin redirects away when user lacks Admin role', async ({ page }) => {
    await page.goto('/admin');
    // Wait for React + Auth0 to resolve and apply the ProtectedRoute redirect
    await expect(page).not.toHaveURL(/\/admin($|\/)/, { timeout: 8000 });
  });

  test('AC14 /admin/users redirects away when user lacks Admin role', async ({ page }) => {
    await page.goto('/admin/users');
    await expect(page).not.toHaveURL(/\/admin\/users/, { timeout: 8000 });
  });

  test('AC15 /admin/cin redirects away when user lacks Admin role', async ({ page }) => {
    await page.goto('/admin/cin');
    await expect(page).not.toHaveURL(/\/admin\/cin/, { timeout: 8000 });
  });
});

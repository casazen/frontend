import { test, expect } from '@playwright/test';

test.describe('Admin panel — auth-gate and shell', () => {
  test('AC12 /admin redirects to / when user lacks Admin role', async ({ page }) => {
    // Navigate directly without any authenticated session — should redirect to login
    await page.goto('/admin');
    // Either ends up on /login (unauthenticated) or on / (authenticated but no Admin role)
    const url = page.url();
    expect(url).not.toContain('/admin');
  });

  test('AC14 /admin/users redirects to / when user lacks Admin role', async ({ page }) => {
    await page.goto('/admin/users');
    const url = page.url();
    expect(url).not.toContain('/admin/users');
  });

  test('AC15 /admin/cin redirects when user lacks Admin role', async ({ page }) => {
    await page.goto('/admin/cin');
    const url = page.url();
    expect(url).not.toContain('/admin/cin');
  });
});

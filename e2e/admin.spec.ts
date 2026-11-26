import { test, expect } from './test';
import { demoUrl, setDemoProfile } from './helpers/demo-profile';
import { pinE2eLocale } from './helpers/locale';

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

  // A1-16: the CIN audit page existed but had no route in the manifest, so it was unreachable from the menu or the
  // URL, and this suite had no test for it (the auth-gate check above uses the pre-existing legacy path only).
  test('AC16 /app/admin/cin redirects away when user lacks Admin role', async ({ page }) => {
    await page.goto('/app/admin/cin');
    await expect(page).not.toHaveURL(/\/app\/admin\/cin/, { timeout: 8000 });
  });
});

test('admin reaches the filtered CIN and OTA records from their dashboard counts', async ({ page }) => {
  test.setTimeout(90_000);
  await setDemoProfile(page, 'admin');
  await pinE2eLocale(page, 'it');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/admin/stats', route => route.fulfill({ json: {
    totalProperties: 42, activeProperties: 40, totalBookings: 150, bookingsThisMonth: 20,
    upcomingCheckIns: 4, totalRevenue: 4000, cinCompliance: { total: 42, valid: 39, missing: 2, invalid: 1 },
    otaSyncHealth: { synced: 10, failed: 21, neverSynced: 1 },
  } }));
  await page.route('**/api/admin/cin-compliance?**', route => {
    const params = new URL(route.request().url()).searchParams;
    expect(params.get('cinStatus')).toBe('missing');
    return route.fulfill({ json: { items: [{ propertyId: 'p-1', propertyName: 'Casa senza CIN', cinStatus: 'missing' }],
      page: 1, pageSize: 20, totalCount: 1 } });
  });
  await page.route('**/api/admin/ota-sync?**', route => {
    const params = new URL(route.request().url()).searchParams;
    const number = Number(params.get('page'));
    const never = params.get('status') === 'neverSynced';
    expect(params.get('status')).toBe(never ? 'neverSynced' : 'failed');
    return route.fulfill({ json: { items: [{ id: 'a', platform: 'Airbnb', propertyName: never ? 'Casa nuova' : `Casa in ritardo ${number}`,
      lastSyncAt: never ? null : '2026-11-18T12:00:00Z' }], totalCount: never ? 1 : 21, pageSize: 20, page: number } });
  });
  await page.goto(demoUrl('/app/admin', 'admin'), { waitUntil: 'domcontentloaded' });
  await page.getByRole('link', { name: /Mancanti 2/ }).click();
  await expect(page.getByTestId('cin-status-filter')).toHaveValue('missing');
  await expect(page.getByText('Casa senza CIN')).toBeVisible();
  await page.goBack();
  await page.getByRole('link', { name: /In ritardo .*21/ }).click();
  await expect(page.getByRole('heading', { name: 'Casa in ritardo 1' })).toBeVisible();
  await page.getByRole('button', { name: 'Successiva' }).click();
  await expect(page.getByRole('heading', { name: 'Casa in ritardo 2' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Stato della sincronizzazione' }).selectOption('neverSynced');
  await expect(page).toHaveURL(/otaStatus=neverSynced/);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Casa nuova' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: 'Successiva' })).toHaveCount(0);
});

import { test, expect } from './test';
import { demoUrl, setDemoProfile } from './helpers/demo-profile';
import { mockSupplierConsoleApi } from './helpers/supplier-console-mock';
import { resetE2eStorage } from './helpers/locale';

test.describe('Supplier layout standardization', () => {
  test.describe('Legacy redirect', () => {
    test('redirects /supplier/inbox to /app/supplier/inbox', async ({ page }) => {
      await setDemoProfile(page, 'supplier');
      await mockSupplierConsoleApi(page, { active: true });
      await page.goto(demoUrl('/supplier/inbox', 'supplier'), { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(/\/app\/supplier\/inbox/);
      await expect(page.getByTestId('supplier-inbox-page')).toBeVisible();
    });

    test('redirects /supplier/activation to /app/supplier/activation', async ({ page }) => {
      await setDemoProfile(page, 'supplier');
      await mockSupplierConsoleApi(page);
      await page.goto(demoUrl('/supplier/activation', 'supplier'), { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(/\/app\/supplier\/activation/);
    });
  });

  test.describe('Desktop sidebar', () => {
    test.use({ viewport: { width: 1280, height: 720 } });

    test('sidebar shows supplier nav items', async ({ page }) => {
      await setDemoProfile(page, 'supplier');
      await mockSupplierConsoleApi(page, { active: true });
      await page.goto(demoUrl('/app/supplier/inbox', 'supplier'), { waitUntil: 'domcontentloaded' });

      const sidebar = page.getByRole('complementary', { name: 'Main navigation' });
      await expect(sidebar).toBeVisible();
      await expect(sidebar.getByRole('link', { name: /Inbox/i })).toBeVisible();
      await expect(sidebar.getByRole('link', { name: /Disponibilità|Availability/i })).toBeVisible();
      await expect(sidebar.getByRole('link', { name: /Profilo|Profile/i })).toBeVisible();
      await expect(sidebar.getByRole('link', { name: /Attivazione|Activation/i })).toBeVisible();
    });

    test('sidebar shows Fornitore subtitle', async ({ page }) => {
      await setDemoProfile(page, 'supplier');
      await mockSupplierConsoleApi(page, { active: true });
      await page.goto(demoUrl('/app/supplier/inbox', 'supplier'), { waitUntil: 'domcontentloaded' });

      const sidebar = page.getByRole('complementary', { name: 'Main navigation' });
      await expect(sidebar.getByText(/Fornitore|Supplier/i)).toBeVisible();
    });

    test('inbox link has aria-current when on inbox page', async ({ page }) => {
      await setDemoProfile(page, 'supplier');
      await mockSupplierConsoleApi(page, { active: true });
      await page.goto(demoUrl('/app/supplier/inbox', 'supplier'), { waitUntil: 'domcontentloaded' });

      const sidebar = page.getByRole('complementary', { name: 'Main navigation' });
      const inboxLink = sidebar.getByRole('link', { name: /Inbox/i });
      await expect(inboxLink).toHaveAttribute('aria-current', 'page');
    });

    test('header is visible with standard height', async ({ page }) => {
      await setDemoProfile(page, 'supplier');
      await mockSupplierConsoleApi(page, { active: true });
      await page.goto(demoUrl('/app/supplier/inbox', 'supplier'), { waitUntil: 'domcontentloaded' });

      const header = page.locator('header');
      await expect(header).toBeVisible();
      const box = await header.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(64);
    });
  });

  test.describe('Mobile navigation', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test.beforeEach(async ({ page }) => {
      await resetE2eStorage(page, 'it');
    });

    test('bottom nav shows supplier primary items', async ({ page }) => {
      await setDemoProfile(page, 'supplier');
      await mockSupplierConsoleApi(page, { active: true });
      await page.goto(demoUrl('/app/supplier/inbox', 'supplier'), { waitUntil: 'domcontentloaded' });

      const bottomNav = page.getByRole('navigation', { name: 'Mobile navigation' });
      await expect(bottomNav).toBeVisible();
      await expect(bottomNav.getByRole('link', { name: /Inbox/i })).toBeVisible();
      await expect(bottomNav.getByRole('link', { name: /Disponibilità|Availability/i })).toBeVisible();
      await expect(bottomNav.getByRole('link', { name: /Profilo|Profile/i })).toBeVisible();
    });

    test('drawer opens from hamburger and shows secondary items', async ({ page }) => {
      await setDemoProfile(page, 'supplier');
      await mockSupplierConsoleApi(page, { active: true });
      await page.goto(demoUrl('/app/supplier/inbox', 'supplier'), { waitUntil: 'domcontentloaded' });

      await page.getByRole('button', { name: /Apri menu di navigazione/i }).click();
      const drawer = page.getByRole('dialog');
      await expect(drawer).toBeVisible();
      await expect(drawer.getByRole('link', { name: /Attivazione|Activation/i })).toBeVisible();
    });

    test('drawer closes on navigation', async ({ page }) => {
      await setDemoProfile(page, 'supplier');
      await mockSupplierConsoleApi(page, { active: true });
      await page.goto(demoUrl('/app/supplier/inbox', 'supplier'), { waitUntil: 'domcontentloaded' });

      await page.getByRole('button', { name: /Apri menu di navigazione/i }).click();
      const drawer = page.getByRole('dialog');
      await drawer.getByRole('link', { name: /Disponibilità|Availability/i }).click();
      await expect(page).toHaveURL(/\/app\/supplier\/availability/);
      await expect(drawer).not.toBeVisible();
    });
  });

  test.describe('WorkspaceSwitcher', () => {
    test.use({ viewport: { width: 1280, height: 720 } });

    test('supplier-only user does not see workspace switcher', async ({ page }) => {
      await setDemoProfile(page, 'supplier');
      await mockSupplierConsoleApi(page, { active: true });
      await page.goto(demoUrl('/app/supplier/inbox', 'supplier'), { waitUntil: 'domcontentloaded' });

      await expect(page.getByRole('tablist', { name: 'Workspace context' })).toHaveCount(0);
    });
  });
});

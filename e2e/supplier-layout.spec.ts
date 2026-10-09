import { test, expect } from './test';
import { demoUrl, setDemoProfile } from './helpers/demo-profile';
import { mockSupplierConsoleApi } from './helpers/supplier-console-mock';
import { pinE2eLocale, resetE2eStorage } from './helpers/locale';

test.describe('Supplier layout standardization', () => {
  test.describe('Activation flow (#292)', () => {
    test('full activation: completes the 5-step wizard, lands on dashboard', async ({ page }) => {
      await setDemoProfile(page, 'supplier');
      await mockSupplierConsoleApi(page);

      await page.goto(demoUrl('/app/supplier/activation', 'supplier'), { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('supplier-activation-page')).toBeVisible({ timeout: 10_000 });
      await expect(page.getByRole('heading', { name: /Attivazione profilo fornitore|Supplier profile activation/i })).toBeVisible();

      // The server opens the first incomplete step: services. It saves category codes, never labels (SU-03, A4-05).
      await expect(page.getByTestId('supplier-activation-step-of')).toContainText(/2/);
      await page.getByTestId('service-category-cleaning').click();
      // The comuni are picked from the official ISTAT list and saved as ISTAT codes (SU-04).
      await page.locator('#comuni').fill('Roma');
      await page.getByRole('option', { name: /^Roma/ }).first().click();
      await expect(page.getByTestId('supplier-comune-chip-058091')).toBeVisible();
      const profileSave = page.waitForRequest((r) => r.url().includes('/api/supplier/profile') && r.method() === 'PUT');
      await page.getByRole('button', { name: /Salva e continua|Save and continue/i }).click();
      const saved = (await profileSave).postDataJSON();
      expect(saved.categories).toEqual(['cleaning']);
      expect(saved.comuneIstatCodes).toEqual(['058091']);

      // Step 3 (photos, optional): skip.
      await page.getByRole('button', { name: /Salta|Skip/i }).click();

      // Step 4: description.
      await page.locator('#bio').fill('Pulizie professionali a Roma');
      await page.getByRole('button', { name: /Salva e continua|Save and continue/i }).click();

      // Step 5: Terms + activate.
      await expect(page.getByTestId('supplier-activation-summary')).toBeVisible();
      await page.locator('#tos').click();
      await page.getByRole('button', { name: /Attiva profilo|Activate profile/i }).click();

      await expect(page).toHaveURL(/\/app\/supplier\/dashboard/, { timeout: 15_000 });
    });

    test('inbox mobile viewport F1 smoke (#292)', async ({ page }) => {
      await setDemoProfile(page, 'supplier');
      await mockSupplierConsoleApi(page, { active: true });
      await page.setViewportSize({ width: 375, height: 812 });

      await page.goto(demoUrl('/supplier/inbox', 'supplier'));
      await expect(page.getByTestId('supplier-inbox-page')).toBeVisible({ timeout: 10_000 });
      await expect(page.getByRole('link', { name: /Richieste|Requests|Inbox/i })).toBeVisible();
    });
  });
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

    test.beforeEach(async ({ page }) => {
      await pinE2eLocale(page, 'en');
    });

    test('sidebar shows supplier nav items', async ({ page }) => {
      await setDemoProfile(page, 'supplier');
      await mockSupplierConsoleApi(page, { active: true });
      await page.goto(demoUrl('/app/supplier/inbox', 'supplier'), { waitUntil: 'domcontentloaded' });

      const sidebar = page.getByRole('complementary', { name: 'Main navigation' });
      await expect(sidebar).toBeVisible();
      await expect(sidebar.getByRole('link', { name: /Dashboard/i })).toBeVisible();
      await expect(sidebar.getByRole('link', { name: /Inbox|Richieste|Requests/i })).toBeVisible();
      await expect(sidebar.getByRole('link', { name: /Disponibilità|Availability/i })).toBeVisible();
      await expect(sidebar.getByRole('link', { name: /Vetrina|Showcase/i })).toBeVisible();
      // UI-04a: the iCal calendar hangs from the availability (no entry of its own); the profile is in "Altro".
      await expect(sidebar.getByRole('link', { name: /Calendario|Calendar/i })).toHaveCount(0);
      await expect(sidebar.getByRole('link', { name: /Profilo|Profile/i })).toHaveCount(0);
      await sidebar.getByRole('button', { name: /Altro|More/i }).click();
      await expect(sidebar.getByRole('link', { name: /Profilo|Profile/i })).toBeVisible();
    });

    test('sidebar is headed by the supplier area', async ({ page }) => {
      await setDemoProfile(page, 'supplier');
      await mockSupplierConsoleApi(page, { active: true });
      await page.goto(demoUrl('/app/supplier/inbox', 'supplier'), { waitUntil: 'domcontentloaded' });

      // A single area has nothing to choose: the heading of the sidebar, not a switcher (UI-04a).
      const sidebar = page.getByRole('complementary', { name: 'Main navigation' });
      await expect(sidebar.getByTestId('area-header')).toContainText(/Portale fornitori|Supplier portal/i);
    });

    test('inbox link has aria-current when on inbox page', async ({ page }) => {
      await setDemoProfile(page, 'supplier');
      await mockSupplierConsoleApi(page, { active: true });
      await page.goto(demoUrl('/app/supplier/inbox', 'supplier'), { waitUntil: 'domcontentloaded' });

      const sidebar = page.getByRole('complementary', { name: 'Main navigation' });
      const inboxLink = sidebar.getByRole('link', { name: /Inbox|Richieste|Requests/i });
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

      const bottomNav = page.getByRole('navigation', { name: 'Navigazione mobile' });
      await expect(bottomNav).toBeVisible();
      await expect(bottomNav.getByRole('link', { name: /Dashboard/i })).toBeVisible();
      await expect(bottomNav.getByRole('link', { name: /Inbox|Richieste|Requests/i })).toBeVisible();
      await expect(bottomNav.getByRole('link', { name: /Disponibilità|Availability/i })).toBeVisible();
      await expect(bottomNav.getByRole('link', { name: /Vetrina|Showcase/i })).toBeVisible();
      // The iCal calendar hangs from the availability: it is not a destination of the bar (UI-04a).
      await expect(bottomNav.getByRole('link', { name: /Calendario|Calendar/i })).toHaveCount(0);
    });

    test('drawer opens from hamburger and shows secondary items', async ({ page }) => {
      await setDemoProfile(page, 'supplier');
      await mockSupplierConsoleApi(page, { active: true });
      await page.goto(demoUrl('/app/supplier/inbox', 'supplier'), { waitUntil: 'domcontentloaded' });

      await page.getByRole('button', { name: /Apri menu di navigazione/i }).click();
      const drawer = page.getByRole('dialog');
      await expect(drawer).toBeVisible();
      await expect(drawer.getByRole('link', { name: /Profilo|Profile/i })).toBeVisible();
    });

    test('drawer closes on navigation', async ({ page }) => {
      await setDemoProfile(page, 'supplier');
      await mockSupplierConsoleApi(page, { active: true });
      await page.goto(demoUrl('/app/supplier/inbox', 'supplier'), { waitUntil: 'domcontentloaded' });

      await page.getByRole('button', { name: /Apri menu di navigazione/i }).click();
      const drawer = page.getByRole('dialog');
      await drawer.getByRole('link', { name: /Profilo|Profile/i }).click();
      await expect(page).toHaveURL(/\/app\/supplier\/profile/);
      await expect(drawer).not.toBeVisible();
    });
  });

  test.describe('Area switcher', () => {
    test.use({ viewport: { width: 1280, height: 720 } });

    test('supplier-only user does not see the area switcher', async ({ page }) => {
      await setDemoProfile(page, 'supplier');
      await mockSupplierConsoleApi(page, { active: true });
      await page.goto(demoUrl('/app/supplier/inbox', 'supplier'), { waitUntil: 'domcontentloaded' });

      await expect(page.getByTestId('area-header')).toBeVisible();
      await expect(page.getByTestId('area-switcher')).toHaveCount(0);
      await expect(page.getByRole('tablist')).toHaveCount(0);
    });
  });
});

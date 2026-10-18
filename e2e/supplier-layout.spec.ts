import { test, expect } from './test';
import { demoUrl, setDemoProfile } from './helpers/demo-profile';
import { mockSupplierConsoleApi } from './helpers/supplier-console-mock';
import { pinE2eLocale, resetE2eStorage } from './helpers/locale';
import { moreOfTheBar } from './helpers/profile-menu';

test.describe('Supplier layout standardization', () => {
  test.describe('Activation flow (#292)', () => {
    test('full activation: completes the three screens, lands on dashboard', async ({ page }) => {
      await setDemoProfile(page, 'supplier');
      await mockSupplierConsoleApi(page);

      await page.goto(demoUrl('/app/supplier/activation', 'supplier'), { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('supplier-activation-page')).toBeVisible({ timeout: 10_000 });
      await expect(page.getByRole('heading', { name: /Attivazione profilo fornitore|Supplier profile activation/i })).toBeVisible();

      // The server opens the first incomplete step: services. It saves category codes, never labels (SU-03, A4-05).
      await expect(page.getByTestId('supplier-activation-step-of')).toContainText(/1 di 3|1 of 3/);
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

      // Presentation: description (the photos on the same screen are optional).
      await page.locator('#bio').fill('Pulizie professionali a Roma');
      await page.getByRole('button', { name: /Salva e continua|Save and continue/i }).click();

      // Terms + activate.
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
      // SP-06 (SP-D1): the menu of the supplier is Home, Richieste, Agenda e disponibilità, Servizi e prezzi, Il mio sito vetrina
      // (then Clienti and Impostazioni, which come with their own tasks), in this order.
      await expect(sidebar.getByRole('link', { name: /Servizi e prezzi|Services and prices/i })).toBeVisible();
      await expect(sidebar.getByRole('link', { name: /Vetrina|Showcase/i })).toBeVisible();
      const labels = await sidebar.locator('a[href^="/app/supplier/"]').evaluateAll((links) =>
        links.map((link) => link.getAttribute('href')),
      );
      expect(labels.slice(0, 5)).toEqual([
        '/app/supplier/dashboard',
        '/app/supplier/inbox',
        '/app/supplier/availability',
        '/app/supplier/services',
        '/app/supplier/showcase',
      ]);
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
      // SP-06 (SP-D11): the fourth place of the bar is "Servizi e prezzi"; the showcase stays in the menu, behind "Altro".
      await expect(bottomNav.getByRole('link', { name: /Servizi e prezzi|Services and prices/i })).toBeVisible();
      await expect(bottomNav.getByRole('link', { name: /Vetrina|Showcase/i })).toHaveCount(0);
      const places = await bottomNav.getByRole('link').evaluateAll((links) => links.map((link) => link.getAttribute('href')));
      expect(places).toEqual([
        '/app/supplier/dashboard',
        '/app/supplier/inbox',
        '/app/supplier/availability',
        '/app/supplier/services',
      ]);
      // The iCal calendar hangs from the availability: it is not a destination of the bar (UI-04a).
      await expect(bottomNav.getByRole('link', { name: /Calendario|Calendar/i })).toHaveCount(0);
    });

    test('the services tab of the bottom bar says "Servizi", which fits its column even on the narrowest phones', async ({ page }) => {
      await setDemoProfile(page, 'supplier');
      await mockSupplierConsoleApi(page, { active: true });

      for (const width of [320, 360, 390]) {
        await page.setViewportSize({ width, height: 800 });
        await page.goto(demoUrl('/app/supplier/inbox', 'supplier'), { waitUntil: 'domcontentloaded' });
        const tab = page.getByRole('navigation', { name: 'Navigazione mobile' }).getByRole('link', { name: 'Servizi e prezzi' });
        // "Servizi e prezzi" alone (74 px) is wider than a column of 360 px (72 px) and would end in an ellipsis: the bar says "Servizi".
        // Only this tab is checked: the width of the other names depends on the fonts of the machine (they have their own test, UI-04b).
        const name = tab.locator('span.truncate');
        await expect(name).toHaveText('Servizi');
        const cut = await name.evaluate((span) => span.scrollWidth > span.clientWidth);
        expect(cut, `${width} px: the name of the services tab is cut`).toBe(false);
      }
    });

    test('the sheet opens from "Altro" of the bottom bar and shows secondary items', async ({ page }) => {
      await setDemoProfile(page, 'supplier');
      await mockSupplierConsoleApi(page, { active: true });
      await page.goto(demoUrl('/app/supplier/inbox', 'supplier'), { waitUntil: 'domcontentloaded' });

      await moreOfTheBar(page).click();
      const sheet = page.getByRole('dialog');
      await expect(sheet).toBeVisible();
      await expect(sheet.getByRole('link', { name: /Profilo|Profile/i })).toBeVisible();
      // The showcase, which is no longer on the bar (SP-06), is here.
      await expect(sheet.getByRole('link', { name: /Vetrina|Showcase/i })).toBeVisible();
    });

    test('the sheet closes on navigation', async ({ page }) => {
      await setDemoProfile(page, 'supplier');
      await mockSupplierConsoleApi(page, { active: true });
      await page.goto(demoUrl('/app/supplier/inbox', 'supplier'), { waitUntil: 'domcontentloaded' });

      await moreOfTheBar(page).click();
      const sheet = page.getByRole('dialog');
      await sheet.getByRole('link', { name: /Profilo|Profile/i }).click();
      await expect(page).toHaveURL(/\/app\/supplier\/profile/);
      await expect(sheet).not.toBeVisible();
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

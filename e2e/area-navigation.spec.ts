import { expect, test } from './test';
import { demoUrl, setDemoProfile } from './helpers/demo-profile';
import { demoAlloggiatiSummary } from './helpers/alloggiati-mock';
import { mockLeasesApiEmpty } from './helpers/lease-api-mock';
import { pinE2eLocale } from './helpers/locale';
import { mockSupplierConsoleApi } from './helpers/supplier-console-mock';

/**
 * UI-04a: navigation by area. The sidebar shows at most seven main entries in named groups and "Altro"; the area switcher
 * replaces the icon tabs; counters, the collapsed sidebar and the pages that hang from a menu entry.
 * The specs that read the roles and names of the old menus (navigation, supplier-layout, context-workspace-switch,
 * long-term-layer) are updated next to them.
 */
test.describe('Area navigation (UI-04a)', () => {
  test.describe('Desktop', () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test.beforeEach(async ({ page }) => {
      await pinE2eLocale(page, 'it');
    });

    test('the main menu has seven entries in three groups and "Altro" holds the rest', async ({ page }) => {
      await page.goto(demoUrl('/app/short-rent', 'short-stay'), { waitUntil: 'domcontentloaded' });

      const menu = page.getByRole('navigation', { name: 'Menu Affitti brevi' });
      await expect(menu.getByRole('group')).toHaveCount(3);
      await expect(menu.getByRole('link')).toHaveCount(7);
      for (const name of ['Cruscotto', 'Calendario', 'Prenotazioni', 'Immobili', 'Sito di prenotazione', 'Marketplace', 'Incassi']) {
        await expect(menu.getByRole('link', { name })).toBeVisible();
      }

      const more = menu.getByRole('button', { name: 'Altro' });
      await expect(more).toHaveAttribute('aria-expanded', 'false');
      await more.click();
      await expect(more).toHaveAttribute('aria-expanded', 'true');
      const others = ['Ospiti', 'Adempimenti', 'Ricavi', 'Regime fiscale', 'Profilo', 'Stripe Connect', 'Dominio pubblico', 'Organizzazione'];
      for (const name of others) {
        await expect(menu.getByRole('link', { name })).toBeVisible();
      }
      // The pages that hang from an entry, and plan and billing, are in no menu.
      for (const name of ['Alloggiati', 'CIN', 'Aspetto sito', 'Documenti sito', 'Piano', 'Fatturazione']) {
        await expect(menu.getByRole('link', { name })).toHaveCount(0);
      }
    });

    test('a user with a single area has a heading, not a switcher', async ({ page }) => {
      await page.goto(demoUrl('/app/short-rent', 'short-stay'), { waitUntil: 'domcontentloaded' });

      const heading = page.getByTestId('area-header');
      await expect(heading).toContainText('Affitti brevi');
      await expect(heading).toContainText('Acme Stays');
      await expect(page.getByTestId('area-switcher')).toHaveCount(0);
      await expect(page.getByRole('tablist')).toHaveCount(0);
    });

    test('the area switcher works from the keyboard and gives the focus back', async ({ page }) => {
      await mockLeasesApiEmpty(page);
      await page.goto(demoUrl('/app/short-rent', 'dual'), { waitUntil: 'domcontentloaded' });

      const switcher = page.getByTestId('area-switcher');
      await expect(switcher).toHaveAttribute('aria-haspopup', 'menu');
      await expect(switcher).toHaveAttribute('aria-expanded', 'false');
      await switcher.focus();
      await page.keyboard.press('Enter');
      await expect(switcher).toHaveAttribute('aria-expanded', 'true');

      // The focus starts on the current area, which is ticked; the description says what each area is for.
      const shortRent = page.getByRole('menuitemradio', { name: /Affitti brevi/ });
      const longRent = page.getByRole('menuitemradio', { name: /Affitti lunghi/ });
      await expect(shortRent).toHaveAttribute('aria-checked', 'true');
      await expect(shortRent).toBeFocused();
      await expect(shortRent).toContainText('Prenotazioni, calendario, prezzi e sito diretto');
      await expect(longRent).toContainText('Contratti, inquilini, scadenze e canoni');

      // Esc closes it and the focus is back on the button.
      await page.keyboard.press('Escape');
      await expect(switcher).toHaveAttribute('aria-expanded', 'false');
      await expect(switcher).toBeFocused();

      // The arrow down opens it again, with the focus on the current area; arrows and Enter choose the other one.
      await page.keyboard.press('ArrowDown');
      await expect(shortRent).toBeFocused();
      await page.keyboard.press('ArrowDown');
      await expect(longRent).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/\/app\/long-rent\/leases/);
      await expect(switcher).toHaveAttribute('aria-label', /Affitti lunghi/);
      await expect(page.getByRole('navigation', { name: 'Menu Affitti lunghi' })).toBeVisible();
    });

    test('the area is remembered: a new visit opens the last one', async ({ page }) => {
      await mockLeasesApiEmpty(page);
      await page.goto(demoUrl('/app/short-rent', 'dual'), { waitUntil: 'domcontentloaded' });
      await page.getByTestId('area-switcher').click();
      await page.getByRole('menuitemradio', { name: /Affitti lunghi/ }).click();
      await expect(page).toHaveURL(/\/app\/long-rent\/leases/);
      expect(await page.evaluate(() => localStorage.getItem('casazen:active-context'))).toBe('long-rent');

      // A new visit at the root of the site opens the last area, not the first.
      await page.goto(demoUrl('/', 'dual'), { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(/\/app\/long-rent\/leases/);
      await expect(page.getByTestId('area-switcher')).toHaveAttribute('aria-label', /Affitti lunghi/);
    });

    test('requests waiting for the host show as a counter on Prenotazioni', async ({ page }) => {
      const request = (n: number) => ({
        id: `request-${n}`,
        propertyId: 'property-1',
        propertyName: 'Casa del Lago',
        checkInDate: '2026-10-20',
        checkOutDate: '2026-10-23',
        nights: 3,
        numberOfGuests: 2,
        numberOfAdults: 2,
        numberOfChildren: 0,
        totalPrice: 300,
        currency: 'EUR',
        specialRequests: '',
        guest: { firstName: 'Anna', lastName: 'Bianchi', email: 'anna@example.com', phone: '+39 333 0000000' },
        emailConfirmedAt: '2026-10-08T10:00:00Z',
        respondBy: '2026-10-09T10:00:00Z',
      });
      // Registered after the default mocks: this one answers.
      await page.route('**/api/bookings/approval-requests**', (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([request(1), request(2)]) }),
      );
      await page.goto(demoUrl('/app/short-rent', 'short-stay'), { waitUntil: 'domcontentloaded' });

      const bookings = page.getByRole('navigation', { name: 'Menu Affitti brevi' }).getByRole('link', { name: /Prenotazioni/ });
      await expect(bookings.getByTestId('nav-count')).toHaveText(/2/);
      await expect(bookings).toHaveAccessibleName(/^Prenotazioni\s*,\s*2 richieste da approvare$/);
      // The other entries of the menu have none (the bar of the phone, hidden on a computer, shows its own: mobile-navigation.spec.ts).
      await expect(page.getByRole('navigation', { name: 'Menu Affitti brevi' }).getByTestId('nav-count')).toHaveCount(1);
    });

    test('no waiting request, no counter', async ({ page }) => {
      await page.goto(demoUrl('/app/short-rent', 'short-stay'), { waitUntil: 'domcontentloaded' });

      await expect(page.getByRole('link', { name: 'Prenotazioni' })).toBeVisible();
      await expect(page.getByTestId('nav-count')).toHaveCount(0);
    });

    test('the supplier sees the requests awaiting an answer on Richieste', async ({ page }) => {
      await setDemoProfile(page, 'supplier');
      await mockSupplierConsoleApi(page, { active: true });
      await page.goto(demoUrl('/app/supplier/availability', 'supplier'), { waitUntil: 'domcontentloaded' });

      const inbox = page.getByRole('navigation', { name: 'Menu Portale fornitori' }).getByRole('link', { name: /Richieste/ });
      await expect(inbox.getByTestId('nav-count')).toHaveText(/1/);
    });

    test('a page inside "Altro" opens it and keeps its entry highlighted', async ({ page }) => {
      await page.goto(demoUrl('/app/short-rent/guests', 'short-stay'), { waitUntil: 'domcontentloaded' });

      const menu = page.getByRole('navigation', { name: 'Menu Affitti brevi' });
      await expect(menu.getByRole('button', { name: 'Altro' })).toHaveAttribute('aria-expanded', 'true');
      await expect(menu.getByRole('link', { name: 'Ospiti' })).toHaveAttribute('aria-current', 'page');
    });

    test('a page that hangs from an entry is reached from that entry and highlights it', async ({ page }) => {
      await page.route('**/api/alloggiati/summary**', (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(demoAlloggiatiSummary) }),
      );
      await page.goto(demoUrl('/app/short-rent', 'short-stay'), { waitUntil: 'domcontentloaded' });

      const menu = page.getByRole('navigation', { name: 'Menu Affitti brevi' });
      await menu.getByRole('button', { name: 'Altro' }).click();
      await menu.getByRole('link', { name: 'Adempimenti' }).click();
      await expect(page).toHaveURL(/\/app\/short-rent\/compliance$/);
      await expect(menu.getByRole('link', { name: 'Adempimenti' })).toHaveAttribute('aria-current', 'page');

      // The page of the entry links to the pages that hang from it.
      const related = page.getByRole('group', { name: 'Pagine collegate' });
      await expect(related.getByRole('link')).toHaveText(['Alloggiati', 'CIN']);
      await related.getByRole('link', { name: 'Alloggiati' }).click();

      await expect(page).toHaveURL(/\/app\/short-rent\/alloggiati$/);
      // Still "Adempimenti" that is highlighted, and "Altro" stays open.
      await expect(menu.getByRole('link', { name: 'Adempimenti' })).toHaveAttribute('aria-current', 'page');
      await expect(menu.getByRole('button', { name: 'Altro' })).toHaveAttribute('aria-expanded', 'true');
      await expect(page.getByRole('link', { name: 'Alloggiati' })).toHaveCount(0);
    });

    test('the site pages are reached from "Sito di prenotazione"', async ({ page }) => {
      await page.goto(demoUrl('/app/short-rent/vetrina', 'short-stay'), { waitUntil: 'domcontentloaded' });

      const related = page.getByRole('group', { name: 'Pagine collegate' });
      await expect(related.getByRole('link')).toHaveText(['Aspetto sito', 'Documenti sito']);
      await related.getByRole('link', { name: 'Documenti sito' }).click();

      await expect(page).toHaveURL(/\/app\/short-rent\/settings\/site-documents$/);
      await expect(page.getByRole('navigation', { name: 'Menu Affitti brevi' }).getByRole('link', { name: 'Sito di prenotazione' })).toHaveAttribute(
        'aria-current',
        'page',
      );
    });

    test('the iCal calendar of the supplier is reached from the availability', async ({ page }) => {
      await setDemoProfile(page, 'supplier');
      await mockSupplierConsoleApi(page, { active: true });
      await page.goto(demoUrl('/app/supplier/availability', 'supplier'), { waitUntil: 'domcontentloaded' });

      await page.getByRole('group', { name: 'Pagine collegate' }).getByRole('link', { name: 'Calendario' }).click();

      await expect(page).toHaveURL(/\/app\/supplier\/calendar$/);
      await expect(
        page.getByRole('navigation', { name: 'Menu Portale fornitori' }).getByRole('link', { name: 'Disponibilità' }),
      ).toHaveAttribute('aria-current', 'page');
    });

    test('plan and billing are one click from the org badge, no longer in the menu', async ({ page }) => {
      await page.goto(demoUrl('/app/short-rent', 'short-stay'), { waitUntil: 'domcontentloaded' });

      const menu = page.getByRole('navigation', { name: 'Menu Affitti brevi' });
      await menu.getByRole('button', { name: 'Altro' }).click();
      await expect(menu.getByRole('link', { name: /Piano|Fatturazione/ })).toHaveCount(0);

      await page.getByTestId('org-badge').click();
      await expect(page).toHaveURL(/\/app\/short-rent\/settings\/plan/);
    });

    test('the sidebar can be reduced to the icons and stays so after a reload', async ({ page }) => {
      await page.goto(demoUrl('/app/short-rent', 'short-stay'), { waitUntil: 'domcontentloaded' });

      const sidebar = page.getByRole('complementary', { name: 'Navigazione principale' });
      await expect(sidebar).toHaveAttribute('data-collapsed', 'false');
      expect((await sidebar.boundingBox())!.width).toBe(256);

      await sidebar.getByRole('button', { name: 'Comprimi menu' }).click();
      await expect(sidebar).toHaveAttribute('data-collapsed', 'true');
      await expect.poll(async () => (await sidebar.boundingBox())!.width).toBe(72);
      // Only the icons are on screen, the names stay for screen readers.
      await expect(sidebar.getByText('Ogni giorno')).toHaveCount(0);
      await expect(sidebar.getByRole('link', { name: 'Calendario' })).toBeVisible();
      // The name is a tooltip on hover and on keyboard focus (UI-04b), no longer the `title` attribute of UI-04a.
      await expect(sidebar.getByRole('link', { name: 'Calendario' })).not.toHaveAttribute('title');
      await sidebar.getByRole('link', { name: 'Calendario' }).hover();
      await expect(page.getByTestId('rail-tooltip')).toHaveText('Calendario');
      await page.mouse.move(700, 500);
      await expect(page.getByTestId('rail-tooltip')).toHaveCount(0);

      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(sidebar).toHaveAttribute('data-collapsed', 'true');
      expect((await sidebar.boundingBox())!.width).toBe(72);

      await sidebar.getByRole('button', { name: 'Espandi menu' }).click();
      await expect(sidebar).toHaveAttribute('data-collapsed', 'false');
      await expect(sidebar.getByText('Ogni giorno')).toBeVisible();
    });

    test('the English interface has English groups, entries and area names', async ({ page }) => {
      await pinE2eLocale(page, 'en');
      await page.goto(demoUrl('/app/short-rent', 'short-stay'), { waitUntil: 'domcontentloaded' });

      const menu = page.getByRole('navigation', { name: 'Short-term rentals menu' });
      await expect(menu.getByRole('group')).toHaveCount(3);
      await expect(menu.getByRole('group', { name: 'Every day' })).toBeVisible();
      await expect(menu.getByRole('link', { name: 'Booking site' })).toBeVisible();
      await expect(menu.getByRole('button', { name: 'More' })).toBeVisible();
      await expect(page.getByTestId('area-header')).toContainText('Short-term rentals');
    });
  });

  test.describe('Phone', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test.beforeEach(async ({ page }) => {
      await pinE2eLocale(page, 'it');
    });

    test('the bottom bar has four destinations and "Altro" opens a sheet with what is left', async ({ page }) => {
      await page.goto(demoUrl('/app/short-rent', 'short-stay'), { waitUntil: 'domcontentloaded' });

      const bar = page.getByRole('navigation', { name: 'Navigazione mobile' });
      await expect(bar.getByRole('link')).toHaveText(['Cruscotto', 'Calendario', 'Prenotazioni', 'Immobili']);
      await bar.getByRole('button', { name: 'Altro' }).click();

      const sheet = page.getByRole('dialog');
      await expect(sheet.getByRole('group', { name: 'La tua offerta' })).toBeVisible();
      await expect(sheet.getByRole('group', { name: 'Gestione' })).toBeVisible();
      await expect(sheet.getByRole('group', { name: 'Altro' })).toBeVisible();
      await expect(sheet.getByRole('link', { name: 'Cruscotto' })).toHaveCount(0);
      await sheet.getByRole('link', { name: 'Profilo' }).click();

      await expect(page).toHaveURL(/\/app\/short-rent\/profile/);
      await expect(sheet).not.toBeVisible();
      // The profile is not one of the destinations of the bar: "Altro" is the marked tab (its sheet is closed again).
      await expect(bar.getByRole('button', { name: 'Altro' })).toHaveAttribute('aria-current', 'page');
      await expect(bar.getByRole('button', { name: 'Altro' })).toHaveAttribute('aria-expanded', 'false');
    });

    test('no horizontal scroll with the area switcher open in the phone menu', async ({ page }) => {
      await mockLeasesApiEmpty(page);
      await page.goto(demoUrl('/app/short-rent', 'dual'), { waitUntil: 'domcontentloaded' });

      await page.getByRole('button', { name: 'Apri menu di navigazione' }).click();
      await page.getByRole('dialog').getByTestId('area-switcher').click();
      await expect(page.getByRole('menuitemradio', { name: /Affitti lunghi/ })).toBeVisible();

      const box = await page.getByRole('menu').boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(390);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    });

    // The same check at 360 px, the narrowest phone of the suite: the menu, the switcher and the page behind them (the
    // headers of the pages, with wider letters, are in page-header-reflow.spec.ts).
    test('no horizontal scroll at 360 px with the area switcher open in the phone menu', async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 800 });
      await mockLeasesApiEmpty(page);
      await page.goto(demoUrl('/app/short-rent', 'dual'), { waitUntil: 'domcontentloaded' });

      await page.getByRole('button', { name: 'Apri menu di navigazione' }).click();
      await page.getByRole('dialog').getByTestId('area-switcher').click();
      await expect(page.getByRole('menuitemradio', { name: /Affitti lunghi/ })).toBeVisible();

      const box = await page.getByRole('menu').boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(360);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    });
  });
});

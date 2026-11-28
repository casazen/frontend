import { expect, test } from './test';
import { demoUrl, setDemoProfile } from './helpers/demo-profile';
import { demoAlloggiatiSummary } from './helpers/alloggiati-mock';
import { mockLeasesApiEmpty } from './helpers/lease-api-mock';
import { pinE2eLocale } from './helpers/locale';
import { mockSupplierConsoleApi } from './helpers/supplier-console-mock';

test.describe('Area navigation (UI-04a)', () => {
  test.describe('Desktop', () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test.beforeEach(async ({ page }) => {
      await pinE2eLocale(page, 'it');
    });

    test('the empty message inbox stretches to the bottom of a tall window', async ({ page }) => {
      await page.setViewportSize({ width: 1600, height: 1000 });
      await page.route(/\/api\/messages\?/, (route) => route.fulfill({ json: { items: [], totalCount: 0, page: 1, pageSize: 20 } }));
      await page.goto(demoUrl('/app/short-rent/messages', 'short-stay'));

      await expect(page.getByText('Nessun messaggio a cui rispondere')).toBeVisible();
      const workspace = page.getByTestId('messages-workspace');
      await expect(workspace).toBeVisible();
      const box = await workspace.boundingBox();
      expect(box?.y).toBeLessThan(250);
      expect(box!.y + box!.height).toBeGreaterThanOrEqual(960);
      expect(box!.y + box!.height).toBeLessThanOrEqual(1000);
    });

    test('the main menu includes Messages in its three groups, with settings at the foot', async ({ page }) => {
      await page.goto(demoUrl('/app/short-rent', 'short-stay'), { waitUntil: 'domcontentloaded' });

      const menu = page.getByRole('navigation', { name: 'Menu Affitti brevi' });
      await expect(menu.getByRole('group')).toHaveCount(3);
      await expect(menu.getByRole('link')).toHaveCount(9);
      for (const name of ['Cruscotto', 'Calendario', 'Prenotazioni', 'Messaggi', 'Adempimenti', 'Immobili', 'Sito di prenotazione', 'Marketplace', 'Incassi']) {
        await expect(menu.getByRole('link', { name })).toBeVisible();
      }

      await expect(menu.getByRole('button', { name: 'Altro' })).toHaveCount(0);
      const foot = page.getByRole('navigation', { name: 'Impostazioni e inviti' });
      await expect(foot.getByRole('link')).toHaveText(['Impostazioni']);
      const inNoMenu = [
        'Ospiti',
        'CRM Ospiti',
        'Recensioni',
        'Ricavi',
        'Report',
        'Documenti',
        'Regime fiscale',
        'Stripe Connect',
        'Canali e calendari',
        'Fornitori fidati',
        'Dominio pubblico',
        'Verifiche',
        'Alloggiati',
        'CIN',
        'Identificazione',
        'Aspetto sito',
        'Documenti sito',
        'Profilo',
        'Piano',
        'Fatturazione',
      ];
      for (const name of inNoMenu) {
        await expect(menu.getByRole('link', { name, exact: true })).toHaveCount(0);
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

      const shortRent = page.getByRole('menuitemradio', { name: /Affitti brevi/ });
      const longRent = page.getByRole('menuitemradio', { name: /Affitti lunghi/ });
      await expect(shortRent).toHaveAttribute('aria-checked', 'true');
      await expect(shortRent).toBeFocused();
      await expect(shortRent).toContainText('Prenotazioni, calendario, prezzi e sito diretto');
      await expect(longRent).toContainText('Contratti, inquilini, scadenze e canoni');

      await page.keyboard.press('Escape');
      await expect(switcher).toHaveAttribute('aria-expanded', 'false');
      await expect(switcher).toBeFocused();

      await page.keyboard.press('ArrowDown');
      await expect(shortRent).toBeFocused();
      await page.keyboard.press('ArrowDown');
      await expect(longRent).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/\/app\/long-rent(?:[?#]|$)/);
      await expect(switcher).toHaveAttribute('aria-label', /Affitti lunghi/);
      await expect(page.getByRole('navigation', { name: 'Menu Affitti lunghi' })).toBeVisible();
    });

    test('the area is remembered: a new visit opens the last one', async ({ page }) => {
      await mockLeasesApiEmpty(page);
      await page.goto(demoUrl('/app/short-rent', 'dual'), { waitUntil: 'domcontentloaded' });
      await page.getByTestId('area-switcher').click();
      await page.getByRole('menuitemradio', { name: /Affitti lunghi/ }).click();
      await expect(page).toHaveURL(/\/app\/long-rent(?:[?#]|$)/);
      expect(await page.evaluate(() => localStorage.getItem('casazen:active-context'))).toBe('long-rent');

      await page.goto(demoUrl('/', 'dual'), { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(/\/app\/long-rent(?:[?#]|$)/);
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
      await page.route('**/api/bookings/approval-requests**', (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([request(1), request(2)]) }),
      );
      await page.goto(demoUrl('/app/short-rent', 'short-stay'), { waitUntil: 'domcontentloaded' });

      const bookings = page.getByRole('navigation', { name: 'Menu Affitti brevi' }).getByRole('link', { name: /Prenotazioni/ });
      await expect(bookings.getByTestId('nav-count')).toHaveText(/2/);
      await expect(bookings).toHaveAccessibleName(/^Prenotazioni\s*,\s*2 richieste da approvare$/);
      await expect(page.getByRole('navigation', { name: 'Menu Affitti brevi' }).getByTestId('nav-count')).toHaveCount(1);
    });

    test('no waiting request, no counter', async ({ page }) => {
      await page.goto(demoUrl('/app/short-rent', 'short-stay'), { waitUntil: 'domcontentloaded' });

      await expect(page.getByRole('link', { name: 'Prenotazioni' })).toBeVisible();
      await expect(page.getByTestId('nav-count')).toHaveCount(0);
    });

    test('the supplier sees the requests awaiting an answer on Richieste', async ({ page }) => {
      await setDemoProfile(page, 'supplier');
      await mockSupplierConsoleApi(page, { active: true, toAnswer: 1 });
      await page.goto(demoUrl('/app/supplier/availability', 'supplier'), { waitUntil: 'domcontentloaded' });

      const inbox = page.getByRole('navigation', { name: 'Menu Portale fornitori' }).getByRole('link', { name: /Richieste/ });
      await expect(inbox.getByTestId('nav-count')).toHaveText(/1/);
    });

    test('a queue of the host is a tab of the Cruscotto, which stays highlighted', async ({ page }) => {
      await page.goto(demoUrl('/app/short-rent/approval-queue', 'short-stay'), { waitUntil: 'domcontentloaded' });

      const menu = page.getByRole('navigation', { name: 'Menu Affitti brevi' });
      await expect(menu.getByRole('link', { name: 'Cruscotto', exact: true })).toHaveAttribute('aria-current', 'page');
      const tabs = page.getByRole('navigation', { name: 'Sezioni di Cruscotto' });
      await expect(tabs.getByRole('link', { name: 'Da approvare' })).toHaveAttribute('aria-current', 'page');
    });

    test('a page that hangs from an entry is reached from that entry and highlights it', async ({ page }) => {
      await page.route('**/api/alloggiati/summary**', (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(demoAlloggiatiSummary) }),
      );
      await page.goto(demoUrl('/app/short-rent', 'short-stay'), { waitUntil: 'domcontentloaded' });

      const menu = page.getByRole('navigation', { name: 'Menu Affitti brevi' });
      await menu.getByRole('link', { name: 'Adempimenti' }).click();
      await expect(page).toHaveURL(/\/app\/short-rent\/compliance$/);
      await expect(menu.getByRole('link', { name: 'Adempimenti' })).toHaveAttribute('aria-current', 'page');

      const tabs = page.getByRole('navigation', { name: 'Sezioni di Adempimenti' });
      await expect(tabs.getByRole('link')).toHaveText(['Adempimenti', 'Alloggiati', 'Report Alloggiati', 'CIN', 'Identificazione']);
      await expect(tabs.getByRole('link', { name: 'Adempimenti' })).toHaveAttribute('aria-current', 'page');
      await tabs.getByRole('link', { name: 'Alloggiati', exact: true }).click();

      await expect(page).toHaveURL(/\/app\/short-rent\/alloggiati$/);
      await expect(menu.getByRole('link', { name: 'Adempimenti' })).toHaveAttribute('aria-current', 'page');
      await expect(menu.getByRole('link', { name: 'Alloggiati', exact: true })).toHaveCount(0);
      await expect(tabs.getByRole('link')).toHaveText(['Adempimenti', 'Alloggiati', 'Report Alloggiati', 'CIN', 'Identificazione']);
      await expect(tabs.getByRole('link', { name: 'Alloggiati', exact: true })).toHaveAttribute('aria-current', 'page');
    });

    test('the pages of a section are tabs on every page of it, and the entry of the menu stays highlighted', async ({ page }) => {
      // The documents of the site are what the page of the third tab reads: none, so that it draws itself in the demo.
      await page.route('**/api/orgs/me/site-documents', (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
      );
      await page.goto(demoUrl('/app/short-rent/vetrina', 'short-stay'), { waitUntil: 'domcontentloaded' });

      const settings = page.getByRole('navigation', { name: 'Impostazioni e inviti' }).getByRole('link', { name: 'Impostazioni' });
      await settings.click();
      await page.getByRole('link', { name: 'Documenti sito' }).click();
      await expect(page).toHaveURL(/\/app\/short-rent\/settings\/site-documents$/);
      await expect(settings).toHaveAttribute('aria-current', 'page');
    });

    test('the guests, reviews and booking flow are tabs of Prenotazioni (the CRM is behind its flag), the payments figures tabs of Incassi', async ({ page }) => {
      await page.goto(demoUrl('/app/short-rent/bookings', 'short-stay'), { waitUntil: 'domcontentloaded' });

      const menu = page.getByRole('navigation', { name: 'Menu Affitti brevi' });
      const bookingTabs = page.getByRole('navigation', { name: 'Sezioni di Prenotazioni' });
      await expect(bookingTabs.getByRole('link')).toHaveText(['Prenotazioni', 'Ospiti', 'Recensioni', 'Flusso']);
      await bookingTabs.getByRole('link', { name: 'Recensioni' }).click();
      await expect(page).toHaveURL(/\/app\/short-rent\/reviews$/);
      await expect(menu.getByRole('link', { name: 'Prenotazioni' })).toHaveAttribute('aria-current', 'page');

      await menu.getByRole('link', { name: 'Incassi' }).click();
      const paymentTabs = page.getByRole('navigation', { name: 'Sezioni di Incassi' });
      await expect(paymentTabs.getByRole('link')).toHaveText(['Incassi', 'Ricavi', 'Report', 'Documenti', 'Regime fiscale']);
      await paymentTabs.getByRole('link', { name: 'Regime fiscale' }).click();
      await expect(page).toHaveURL(/\/app\/short-rent\/fiscal$/);
      await expect(menu.getByRole('link', { name: 'Incassi' })).toHaveAttribute('aria-current', 'page');
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
      await expect(menu.getByRole('link', { name: /Piano|Fatturazione/ })).toHaveCount(0);
      await expect(page.getByRole('navigation', { name: 'Impostazioni e inviti' }).getByRole('link', { name: /Piano|Fatturazione/ })).toHaveCount(0);

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
      await expect(sidebar.getByText('Ogni giorno')).toHaveCount(0);
      await expect(sidebar.getByRole('link', { name: 'Calendario' })).toBeVisible();
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
      await expect(page.getByRole('navigation', { name: 'Settings and invitations' }).getByRole('link', { name: 'Settings' })).toBeVisible();
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
      await expect(sheet.getByRole('group', { name: 'Impostazioni e inviti' })).toBeVisible();
      await expect(sheet.getByRole('link', { name: 'Cruscotto' })).toHaveCount(0);
      await expect(sheet.getByRole('group', { name: 'Impostazioni e inviti' }).getByRole('link')).toHaveText(['Impostazioni']);
      await sheet.getByRole('link', { name: 'Adempimenti' }).click();

      await expect(page).toHaveURL(/\/app\/short-rent\/compliance/);
      await expect(sheet).not.toBeVisible();
      await expect(bar.getByRole('button', { name: 'Altro' })).toHaveAttribute('aria-current', 'page');
      await expect(bar.getByRole('button', { name: 'Altro' })).toHaveAttribute('aria-expanded', 'false');
    });

    test('a tab of a section is a menu on a phone, and the bar marks the entry of the section', async ({ page }) => {
      await page.goto(demoUrl('/app/short-rent/bookings', 'short-stay'), { waitUntil: 'domcontentloaded' });

      const select = page.getByTestId('nav-section-select');
      await expect(select).toBeVisible();
      await select.selectOption({ label: 'Ospiti' });

      await expect(page).toHaveURL(/\/app\/short-rent\/guests$/);
      await expect(page.getByTestId('nav-section-select')).toHaveValue('/app/short-rent/guests');
      const bar = page.getByRole('navigation', { name: 'Navigazione mobile' });
      await expect(bar.getByRole('link', { name: 'Prenotazioni' })).toHaveAttribute('aria-current', 'page');
    });

    test('no horizontal scroll with the area switcher open in the phone menu', async ({ page }) => {
      await mockLeasesApiEmpty(page);
      await page.goto(demoUrl('/app/short-rent', 'dual'), { waitUntil: 'domcontentloaded' });

      await page.locator('[data-more-trigger]').click();
      await page.getByRole('dialog').getByTestId('area-switcher').click();
      await expect(page.getByRole('menuitemradio', { name: /Affitti lunghi/ })).toBeVisible();

      const box = await page.getByRole('menu').boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(390);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    });

    test('no horizontal scroll at 360 px with the area switcher open in the phone menu', async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 800 });
      await mockLeasesApiEmpty(page);
      await page.goto(demoUrl('/app/short-rent', 'dual'), { waitUntil: 'domcontentloaded' });

      await page.locator('[data-more-trigger]').click();
      await page.getByRole('dialog').getByTestId('area-switcher').click();
      await expect(page.getByRole('menuitemradio', { name: /Affitti lunghi/ })).toBeVisible();

      const box = await page.getByRole('menu').boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(360);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    });
  });
});

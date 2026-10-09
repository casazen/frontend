import type { Locator, Page } from '@playwright/test';
import { expect, test } from './test';
import { demoUrl, type DemoProfile } from './helpers/demo-profile';
import { mockLeasesApiEmpty } from './helpers/lease-api-mock';
import { pinE2eLocale } from './helpers/locale';
import { mockSupplierConsoleApi } from './helpers/supplier-console-mock';

/**
 * UI-04a (CI fix): the header of a page (title, description and, on the right, its controls) fits a phone whatever the
 * font of the machine. The L2 suite runs on Linux, where the system font is wider than the Segoe UI of the Windows
 * machines these specs are written on: the Period select of the dashboard stuck out of the screen there and the whole
 * page scrolled sideways (the check of the phone menu in area-navigation.spec.ts failed on it in CI). The fonts installed
 * differ from machine to machine, so here the letters are widened by 8 % of the font size (about what Verdana or DejaVu
 * Sans add to Segoe UI) and the check no longer depends on the fonts of the machine that runs it.
 */
const WIDER_LETTERS = 'body, body * { letter-spacing: 0.08em !important; }';
const PHONES = [360, 390];

interface HeaderPage {
  name: string;
  path: string;
  profile: DemoProfile;
  heading: string;
  /** The controls of the header: they are on the screen too, not only the document does not scroll sideways. */
  controls: (page: Page) => Locator;
  supplier?: boolean;
}

const childLinks = (page: Page) => page.getByTestId('nav-child-links');

const PAGES: HeaderPage[] = [
  { name: 'dashboard (period select)', path: '/app/short-rent', profile: 'dual', heading: 'Cruscotto', controls: (page) => page.getByTestId('dashboard-period') },
  { name: 'compliance (pages that hang from it)', path: '/app/short-rent/compliance', profile: 'dual', heading: 'Cockpit compliance', controls: childLinks },
  { name: 'booking site (pages that hang from it)', path: '/app/short-rent/vetrina', profile: 'dual', heading: 'Direct Booking', controls: childLinks },
  { name: 'CIN audit of the console (pages that hang from it)', path: '/app/admin/cin', profile: 'admin', heading: 'Conformità CIN', controls: childLinks },
  { name: 'supplier availability (link to the calendar)', path: '/app/supplier/availability', profile: 'supplier', heading: 'Disponibilità', controls: childLinks, supplier: true },
  { name: 'bookings (new booking)', path: '/app/short-rent/bookings', profile: 'dual', heading: 'Prenotazioni', controls: (page) => page.getByTestId('new-booking') },
  // The empty list repeats "Nuovo contratto" under the header: the first one in the page is the button of the header.
  { name: 'long-term contracts (new contract)', path: '/app/long-rent/leases', profile: 'dual', heading: 'Contratti lungo termine', controls: (page) => page.getByRole('button', { name: 'Nuovo contratto' }).first() },
];

test.describe('Page header on a phone (UI-04a CI fix)', () => {
  for (const entry of PAGES) {
    test(`${entry.name}: nothing sticks out of the screen at 360 and 390 px, even with wider letters`, async ({ page }) => {
      await pinE2eLocale(page, 'it');
      if (entry.profile === 'dual') await mockLeasesApiEmpty(page);
      if (entry.supplier) await mockSupplierConsoleApi(page, { active: true });

      for (const width of PHONES) {
        await page.setViewportSize({ width, height: 800 });
        await page.goto(demoUrl(entry.path, entry.profile), { waitUntil: 'domcontentloaded' });
        await expect(page.getByRole('heading', { level: 1, name: entry.heading })).toBeVisible();
        await page.addStyleTag({ content: WIDER_LETTERS });

        const box = await entry.controls(page).boundingBox();
        expect(box, `${width} px: the controls of the header are on the page`).not.toBeNull();
        expect(box!.x, `${width} px: the controls start inside the screen`).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width, `${width} px: the controls end inside the screen`).toBeLessThanOrEqual(width);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
          `${width} px: the page does not scroll sideways`,
        ).toBeLessThanOrEqual(0);
      }
    });
  }
});

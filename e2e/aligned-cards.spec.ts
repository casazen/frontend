import type { Locator, Page } from '@playwright/test';
import { expect, test } from './test';
import { demoUrl } from './helpers/demo-profile';
import { pinE2eLocale } from './helpers/locale';
import { mockBillingSubscription, mockCurrentUserWithOrg, mockEntitlement } from './helpers/org-api-mock';
import type { PublicPropertyDto } from '../src/types';

/**
 * Cards of a row look the same: their sections (the title, the text, the list, the button...) start at the same height even when
 * a title wraps on two lines or a card has less to say than its neighbours. The cards of a grid are subgrids of it
 * (`AlignedCard`, and the same utilities where a card is not a `Card`), so each section is a row of the grid and a row is as
 * tall as its tallest section.
 */

/** `top` or `bottom` of the box of each element: one number per element, in px from the top of the viewport. */
async function edges(elements: Locator[], edge: 'top' | 'bottom'): Promise<number[]> {
  return Promise.all(
    elements.map(async (element) => {
      const box = await element.boundingBox();
      if (!box) throw new Error(`no box for ${String(element)}`);
      return edge === 'top' ? box.y : box.y + box.height;
    }),
  );
}

/** The lines a text takes (the box of the element is the row of the grid, as tall as the longest title of the row). */
async function linesOf(element: Locator): Promise<number> {
  return element.evaluate((node) => {
    const range = document.createRange();
    range.selectNodeContents(node);
    return new Set(Array.from(range.getClientRects(), (rect) => Math.round(rect.top))).size;
  });
}

/** The elements start (or end) at the same height: a pixel is the rounding of a fractional line height, not a difference. */
async function expectAligned(elements: Locator[], what: string, edge: 'top' | 'bottom' = 'top'): Promise<void> {
  expect(elements.length, `${what}: at least two cards to compare`).toBeGreaterThan(1);
  const values = await edges(elements, edge);
  expect(Math.max(...values) - Math.min(...values), `${what} (${edge}) at ${values.map((v) => v.toFixed(1)).join(', ')}`).toBeLessThanOrEqual(1);
}

test.describe('Aligned cards', () => {
  test.beforeEach(async ({ page }) => {
    await pinE2eLocale(page, 'it');
    // The cookie banner is not what these specs are about.
    await page.addInitScript(() => localStorage.setItem('casazen_cookie_consent', 'rejected'));
  });

  test.describe('Onboarding: the three ways to start', () => {
    for (const width of [1060, 1900]) {
      test(`the title, the text, the list and the button of the three cards line up at ${width} px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(demoUrl('/onboarding', 'onboarding'));

        const titles = page.getByRole('heading', { level: 3 });
        await expect(titles).toHaveCount(3);
        const cards = titles.locator('..');
        const each = (selector: string) => [0, 1, 2].map((index) => cards.nth(index).locator(selector).first());

        // At 1060 px "Locazioni di lungo periodo" wraps on two lines: that is what used to push down the rest of its card.
        if (width === 1060) {
          expect(await linesOf(titles.nth(0))).toBe(1);
          expect(await linesOf(titles.nth(1))).toBe(2);
        }

        await expectAligned(each('h3'), 'title');
        await expectAligned(each('p'), 'text');
        await expectAligned(each('ol'), 'list');
        await expectAligned(each('button'), 'button');
        await expectAligned(each('button'), 'button', 'bottom');
        await expectAligned([0, 1, 2].map((index) => cards.nth(index)), 'card', 'bottom');
      });
    }
  });

  test.describe('Public property cards', () => {
    const base = {
      slug: null,
      postalCode: '00153',
      bedrooms: 2,
      bathrooms: 1,
      maxGuests: 4,
      nightlyRate: 165,
      cleaningFee: 55,
      amenities: ['Wifi'],
      photoUrls: [],
      timezone: 'Europe/Rome',
    };

    // Three cards of a row that differ the way real ones do: a name on three lines or on one, a description of two lines, of
    // one or none, a CIN or none, facts that wrap or fit.
    const properties: PublicPropertyDto[] = [
      {
        ...base,
        id: '00000000-0000-4000-8000-000000000001',
        name: 'Attico panoramico con terrazza privata sul centro storico di Roma e sui Fori Imperiali',
        description: 'Un attico luminoso con una grande terrazza che guarda i tetti di Roma. Due camere, cucina completa, aria condizionata.',
        city: 'Roma',
        cinCode: 'IT058091C27G5FFZDZ',
        cinStatus: 'Valid',
      },
      {
        ...base,
        id: '00000000-0000-4000-8000-000000000002',
        name: 'Loft Duomo',
        description: 'Loft a due passi dal Duomo.',
        city: 'Milano',
        postalCode: '20121',
        cinCode: null,
        cinStatus: 'Missing',
      },
      {
        ...base,
        id: '00000000-0000-4000-8000-000000000003',
        name: 'Casa vacanze sul lago di Como con giardino',
        description: '',
        city: 'Como',
        postalCode: '22100',
        bedrooms: 3,
        bathrooms: 2,
        maxGuests: 6,
        nightlyRate: 240,
        cinCode: 'IT013075C2LKXQ4ZUB',
        cinStatus: 'Valid',
      },
    ];

    async function mockOrgSite(page: Page): Promise<void> {
      await page.route('**/api/public/orgs/**', async (route) => {
        const url = route.request().url();
        if (route.request().method() !== 'GET' || url.includes('/properties/')) {
          await route.fallback();
          return;
        }
        const body = url.endsWith('/properties')
          ? properties
          : { slug: 'demo-casazen', displayName: 'Demo Casazen Stays', logoUrl: null, themeColor: '#2563eb', contactEmail: 'prenotazioni@demo.example' };
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      });
      await page.route('**/api/properties/search**', async (route) => {
        if (route.request().method() !== 'GET') {
          await route.fallback();
          return;
        }
        const results = properties.map((property) => ({ ...property, orgSlug: 'demo-casazen', slug: `p-${property.id.slice(-1)}` }));
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(results) });
      });
    }

    /** Where the parts of the three cards start: the name, the place, the CIN (two cards have it), the text, the facts and the price. */
    async function expectCardsAligned(page: Page): Promise<void> {
      const cards = page.getByTestId('public-property-card');
      await expect(cards).toHaveCount(3);
      const each = (selector: string) => [0, 1, 2].map((index) => cards.nth(index).locator(selector).first());

      // The name of the first card is on three lines or more, the second on one: without the rows that pushed down everything
      // under the longer name, in its card only.
      expect(await linesOf(cards.nth(0).locator('h3'))).toBeGreaterThanOrEqual(3);
      expect(await linesOf(cards.nth(1).locator('h3'))).toBe(1);

      await expectAligned(each('h3'), 'name');
      await expectAligned(each('h3 + p'), 'place');
      await expectAligned([cards.nth(0), cards.nth(2)].map((card) => card.getByTestId('public-cin')), 'CIN');
      await expectAligned([cards.nth(0), cards.nth(1)].map((card) => card.locator('p.line-clamp-2')), 'description');
      await expectAligned(each('[data-testid=public-property-card-facts]'), 'facts');
      await expectAligned(each('[data-testid=public-property-card-price]'), 'price', 'bottom');
      await expectAligned([0, 1, 2].map((index) => cards.nth(index)), 'card', 'bottom');
    }

    test('the landing page of a host lines the cards up row by row', async ({ page }) => {
      await mockOrgSite(page);
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto('/book/demo-casazen');

      await expectCardsAligned(page);
    });

    test('the search results line the cards up row by row', async ({ page }) => {
      await mockOrgSite(page);
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(demoUrl('/search', 'short-stay'));

      await expectCardsAligned(page);
    });

    test('on a phone the cards are one column with no empty rows to fill', async ({ page }) => {
      await mockOrgSite(page);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/book/demo-casazen');

      await expect(page.getByTestId('public-property-card')).toHaveCount(3);
      // The rows that keep the cards of a row in step are empty ones; in a single column there is nothing to keep in step with.
      const rowsShown = await page.evaluate(() =>
        [...document.querySelectorAll('[data-testid=public-property-card] > div:empty')].filter((row) => getComputedStyle(row).display !== 'none').length,
      );
      expect(rowsShown).toBe(0);
    });
  });

  test.describe('Plans page (billing)', () => {
    test('the buttons of the plans end at the bottom of their cards, also the one that cannot be pressed and has a hint', async ({ page }) => {
      await mockCurrentUserWithOrg(page, { name: 'Acme Stays', planTier: 'Starter' });
      await mockEntitlement(page, { planTier: 'Starter', maxProperties: 3, properties: 1 });
      await mockBillingSubscription(page, { status: 'none' });
      // The Pro plan cannot be bought: its button is disabled and a line says why. The lists have different lengths.
      await page.route('**/api/billing/plans', async (route) => {
        const plan = (tier: string, unitAllowance: number, features: string[], purchasable: boolean) => ({
          tier,
          displayName: tier,
          priceMonthly: null,
          currency: 'EUR',
          unitAllowance,
          features,
          purchasable,
        });
        const plans = [
          plan('Starter', 3, ['Sito di prenotazione', 'Calendario iCal'], true),
          plan('Pro', 50, ['Tutto Starter', 'Fornitori', 'Stime fiscali', 'Assistenza', 'Dominio personalizzato'], false),
          plan('Scale', -1, ['Tutto Pro'], true),
        ];
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(plans) });
      });
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(demoUrl('/app/short-rent/settings/plan', 'short-stay'));

      const cards = ['Starter', 'Pro', 'Scale'].map((tier) => page.getByTestId(`plan-card-${tier}`));
      await expect(cards[1].getByText('Questo piano non è acquistabile al momento.')).toBeVisible();

      await expectAligned(
        cards.map((card) => card.getByRole('button')),
        'button',
        'bottom',
      );
      await expectAligned(
        cards.map((card) => card.getByRole('button')),
        'button',
      );
      // The hint is above the button of its plan, not under it.
      const [hint, button] = await Promise.all([
        cards[1].getByText('Questo piano non è acquistabile al momento.').boundingBox(),
        cards[1].getByRole('button').boundingBox(),
      ]);
      expect(hint!.y + hint!.height).toBeLessThanOrEqual(button!.y);
    });
  });

  test.describe('Featured properties of a guide (public SEO pages)', () => {
    test('the facts, the price and the button of the cards of a row line up whatever the length of the names', async ({ page }) => {
      await page.route('**/api/public/content/affitti-brevi/**', async (route) => {
        const guide = {
          id: 'seo-1',
          pageType: 'ComplianceGuide',
          title: 'Affitti brevi a Como',
          metaDescription: 'Guida',
          bodyHtml: '<p>Le regole degli affitti brevi a Como.</p>',
          comuneName: 'Como',
          comuneCode: '013075',
          regionCode: '03',
          regionSlug: 'lombardia',
          comuneSlug: 'como',
          canonicalUrl: null,
          lastRefreshedAt: null,
          aiGenerated: false,
          contentLanguage: 'it',
          cta: null,
          touristTaxRates: [],
        };
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(guide) });
      });
      await page.route('**/api/public/seo/*/featured-properties', async (route) => {
        const property = (n: number, name: string, bedrooms: number) => ({
          id: `00000000-0000-4000-8000-00000000010${n}`,
          slug: `p-${n}`,
          orgSlug: 'demo-casazen',
          name,
          city: 'Como',
          bedrooms,
          bathrooms: 1,
          maxGuests: 4,
          nightlyRate: 120 + n * 10,
          photoUrl: null,
        });
        const properties = [
          property(1, 'Attico panoramico con terrazza privata sul lago di Como e sulle montagne', 2),
          property(2, 'Loft Duomo', 0),
          property(3, 'Casa vacanze con giardino', 3),
        ];
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ comuneSlug: 'como', comuneName: 'Como', properties }) });
      });
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto('/p/affitti-brevi/lombardia/como');

      const cards = page.getByTestId('featured-property');
      await expect(cards).toHaveCount(3);
      const each = (selector: string) => [0, 1, 2].map((index) => cards.nth(index).locator(selector).first());
      // The first name is on three lines, the others on one: the facts, the price and the button of those used to sit higher.
      expect(await linesOf(each('h3')[0])).toBeGreaterThanOrEqual(3);
      expect(await linesOf(each('h3')[1])).toBe(1);

      await expectAligned(each('h3'), 'name');
      await expectAligned(each('h3 + p'), 'facts');
      await expectAligned(each('h3 + p + p'), 'price');
      await expectAligned(each('[data-testid=featured-property-link]'), 'button');
      await expectAligned([0, 1, 2].map((index) => cards.nth(index)), 'card', 'bottom');
    });
  });

  test.describe('Numbers (StatStrip)', () => {
    test('the numbers of a strip start at the same height whatever the length of their names', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto('/dev/calm-blocks');

      // "Prenotazioni in arrivo" and its chevron are on two lines: its number used to be lower than the others.
      const strip = page.getByTestId('strip-4');
      const tiles = strip.getByRole('listitem');
      await expect(tiles).toHaveCount(4);
      expect(await linesOf(tiles.nth(1).locator('span.flex > span.min-w-0'))).toBe(2);
      expect(await linesOf(tiles.nth(0).locator('span.flex > span.min-w-0'))).toBe(1);

      const each = (selector: string) => [0, 1, 2, 3].map((index) => tiles.nth(index).locator(selector).first());
      await expectAligned(each('span.flex'), 'name');
      await expectAligned(each('.text-2xl'), 'number');
      // The names of one line stay at the top, as the first line of the longer one.
      const [short, long] = await Promise.all([each('span.flex > span.min-w-0')[0].boundingBox(), each('span.flex > span.min-w-0')[1].boundingBox()]);
      expect(Math.abs(short!.y - long!.y)).toBeLessThanOrEqual(1);
    });

    test('three numbers are three across from a tablet, not two and one alone', async ({ page }) => {
      await page.setViewportSize({ width: 900, height: 900 });
      await page.goto('/dev/calm-blocks');

      const tiles = page.getByTestId('strip-3').getByRole('listitem');
      await expect(tiles).toHaveCount(3);
      await expectAligned([0, 1, 2].map((index) => tiles.nth(index)), 'tile');
      await expectAligned([0, 1, 2].map((index) => tiles.nth(index).locator('.text-2xl')), 'number');
    });

    test('the Home of Affitti brevi lines its numbers up beside the list of the next arrivals', async ({ page }) => {
      const arrival = (bookingId: string, guestName: string, day: string) => ({
        bookingId,
        propertyId: 'p1',
        propertyName: 'Casa del Faro',
        guestName,
        numberOfGuests: 2,
        checkInDate: `${day}T00:00:00`,
        checkOutDate: '2026-10-30',
        awaitingApproval: false,
      });
      await page.route('**/api/dashboard/overview**', async (route) => {
        if (route.request().method() !== 'GET') {
          await route.fallback();
          return;
        }
        const overview = {
          period: { kind: 'Month', from: '2026-10-01', to: '2026-10-31', nights: 31 },
          today: '2026-10-17',
          propertyCount: 3,
          occupancy: { occupiedNights: 60, availableNights: 90, closedNights: 3, rate: 0.67, deltaPoints: -4 },
          revenue: { amount: 12480, currency: 'EUR', stayCount: 14, deltaPercent: 9 },
          upcoming: { count: 12, previousCount: 9, pendingApproval: 2 },
          nextArrivals: [arrival('b1', 'Maria Rossi', '2026-10-17'), arrival('b2', 'Giovanni Bianchi', '2026-10-18'), arrival('b3', 'Elisa Verdi', '2026-10-24')],
          series: { unit: 'week', buckets: [] },
        };
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(overview) });
      });
      // A laptop with the sidebar open: each of the four columns is about 170 px, and the third name does not fit on one line.
      await page.setViewportSize({ width: 1040, height: 900 });
      await page.goto(demoUrl('/app/short-rent', 'short-stay'));

      const numbers = page.getByTestId('home-numbers');
      const tiles = numbers.getByRole('listitem').filter({ has: page.locator('.text-2xl') });
      await expect(tiles).toHaveCount(3);
      await expect(numbers.getByTestId('home-next-arrivals')).toBeVisible();
      expect(await linesOf(tiles.nth(2).locator('span.flex > span.min-w-0'))).toBe(2);

      await expectAligned([0, 1, 2].map((index) => tiles.nth(index).locator('span.flex')), 'name');
      await expectAligned([0, 1, 2].map((index) => tiles.nth(index).locator('.text-2xl')), 'number');
      // The list of arrivals is not made of those rows: it starts at the top, at the height of the names, and does not make them taller.
      await expectAligned([tiles.nth(0).locator('span.flex'), numbers.getByTestId('home-next-arrivals').locator('p').first()], 'name and list title');
      const [name, value] = await Promise.all([tiles.nth(0).locator('span.flex').boundingBox(), tiles.nth(0).locator('.text-2xl').boundingBox()]);
      expect(value!.y - name!.y, 'the number is right under the name (two lines), not pushed down by the list').toBeLessThan(80);
    });
  });

  test.describe('Public site (src/site)', () => {
    // The site has its own stylesheet, which finds its classes by scanning src/site/ only: a class written anywhere else would
    // not be there, and the cards would not line up. So this is checked on the page, not only on the markup.

    /**
     * The dev server serves the template of a page, not the prerendered page: it is given the root element that the browser entry
     * of the site renders into (as `scripts/prerender-site.mjs` does at build time).
     */
    async function openSitePage(page: Page, id: 'home' | 'features'): Promise<void> {
      await page.route('**/__site/*', async (route) => {
        const url = new URL(route.request().url());
        const response = await route.fetch({ url: new URL('/site.html', url).toString() });
        const html = (await response.text())
          .replace('<!--site-root-->', `<div id="root" data-site-page="${url.pathname.split('/').pop()}" data-site-year="2026"></div>`)
          .replace('<!--site-head-->', '');
        await route.fulfill({ status: 200, contentType: 'text/html', body: html });
      });
      await page.goto(`/__site/${id}`);
    }

    /** The cards of the grid under the heading `name`. */
    function cardsUnder(page: Page, name: string): Locator {
      return page.locator('section', { has: page.getByRole('heading', { name, exact: true }) }).locator('div.grid > div');
    }

    test('the four cards of "Per chi è CasaZen" line up whatever the length of their titles and texts', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await openSitePage(page, 'home');

      const cards = cardsUnder(page, 'Per chi è CasaZen');
      await expect(cards).toHaveCount(4);
      const each = (selector: string) => [0, 1, 2, 3].map((index) => cards.nth(index).locator(selector).first());

      // "Proprietari di affitti lunghi" is on two lines, the other titles on one.
      expect(await linesOf(each('h3')[2])).toBe(2);
      expect(await linesOf(each('h3')[0])).toBe(1);

      await expectAligned(each('h3'), 'title');
      await expectAligned(each('p'), 'text');
      await expectAligned([0, 1, 2, 3].map((index) => cards.nth(index)), 'card', 'bottom');
    });

    test('the cards of the features page start their lists at the same height', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await openSitePage(page, 'features');

      const cards = page.locator('div.grid > div:has(> h2)');
      await expect(cards).toHaveCount(7);
      // The first row: the text of the first two cards is on two lines, the one of the third on one.
      const firstRow = [0, 1, 2].map((index) => cards.nth(index));
      expect(await linesOf(firstRow[0].locator('p').first())).toBe(2);
      expect(await linesOf(firstRow[2].locator('p').first())).toBe(1);

      await expectAligned(
        firstRow.map((card) => card.locator('ul')),
        'list',
      );
      await expectAligned(
        firstRow.map((card) => card),
        'card',
        'bottom',
      );
    });

    test('on a phone a card is a plain column, as before', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await openSitePage(page, 'home');

      const card = cardsUnder(page, 'Per chi è CasaZen').first();
      await expect(card).toBeVisible();
      expect(await card.evaluate((node) => getComputedStyle(node).display)).toBe('flex');
    });
  });
});

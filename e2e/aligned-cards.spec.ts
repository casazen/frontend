import type { Locator, Page } from '@playwright/test';
import { expect, test } from './test';
import { demoUrl } from './helpers/demo-profile';
import { pinE2eLocale } from './helpers/locale';
import { mockBillingSubscription, mockCurrentUserWithOrg, mockEntitlement } from './helpers/org-api-mock';
import { mockPropertiesApi } from './helpers/properties-api-mock';
import { mockServiceCategoriesApi } from './helpers/service-categories-mock';
import { buildCreatedProperty } from './fixtures/properties.fixtures';
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

/**
 * Replaces the text of an element, to make a name as long (or as short) as a test needs. How many lines a copy takes depends on
 * the font of the machine (the same page wraps differently on a laptop and on the CI), so a test that needs a title on one line
 * next to a title on several does not trust the copy: it writes both.
 */
async function setText(element: Locator, text: string): Promise<void> {
  await element.evaluate((node, value) => {
    node.textContent = value;
  }, text);
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

        // At 1060 px "Locazioni di lungo periodo" wraps on two lines or fits on one, according to the font: the title is made long
        // on purpose, because a title on more lines than the first is what used to push down the rest of its card.
        if (width === 1060) {
          await setText(titles.nth(1), 'Locazioni di lungo periodo, con contratto e canone');
          expect(await linesOf(titles.nth(1))).toBeGreaterThan(await linesOf(titles.nth(0)));
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

  test.describe('Admin dashboard', () => {
    test('the six numbers are two rows of three, and the numbers of a row start at the same height', async ({ page }) => {
      await page.route('**/api/admin/stats', async (route) => {
        const stats = {
          totalProperties: 128,
          activeProperties: 97,
          totalBookings: 4210,
          bookingsThisMonth: 311,
          upcomingCheckIns: 42,
          totalRevenue: 1284500.5,
          cinCompliance: { valid: 80, missing: 30, invalid: 18, total: 128 },
          otaSyncHealth: { synced: 60, failed: 4, neverSynced: 12 },
        };
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(stats) });
      });
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(demoUrl('/app/admin', 'admin'));

      // The six numbers are the cards with a big number; the CIN and OTA cards under them are another grid.
      const cards = page.locator('div.grid > div.rounded-lg').filter({ has: page.locator('.text-2xl') });
      await expect(cards).toHaveCount(6);
      const row = (first: number) => [first, first + 1, first + 2].map((index) => cards.nth(index));

      // Three across from a laptop: a line of four and two alone left empty cells on the right.
      await expectAligned(row(0), 'first row', 'top');
      await expectAligned(row(3), 'second row', 'top');
      const [firstRow, secondRow] = await Promise.all([cards.nth(0).boundingBox(), cards.nth(3).boundingBox()]);
      expect(secondRow!.y).toBeGreaterThan(firstRow!.y + firstRow!.height - 1);
      await expectAligned(row(0).map((card) => card.locator('.text-2xl')), 'numbers of the first row');
      await expectAligned(row(3).map((card) => card.locator('.text-2xl')), 'numbers of the second row');
    });

  });

  test.describe('Plan cards of the admin dialog (change the plan of an org)', () => {
    test('the limit and the button of the three cards line up whatever the length of the descriptions', async ({ page }) => {
      // Three descriptions of one, two and four lines in the width of the dialog.
      await page.route('**/api/orgs/plans', async (route) => {
        const plan = (tier: string, maxProperties: number, description: string) => ({ tier, displayName: tier, maxProperties, description });
        const plans = [
          plan('Starter', 3, 'Per iniziare.'),
          plan('Pro', 50, 'Fino a 50 proprietà per operatori in crescita che hanno bisogno di più spazio per le loro strutture e di più utenti.'),
          plan('Scale', -1, 'Proprietà illimitate, per agenzie e property manager.'),
        ];
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(plans) });
      });
      await page.route(/\/api\/users(\?.*)?$/, async (route) => {
        if (route.request().method() !== 'GET') {
          await route.continue();
          return;
        }
        const user = {
          id: 'auth0|target-user',
          email: 'owner@example.com',
          firstName: 'Mario',
          lastName: 'Rossi',
          role: 'PropertyOwner',
          rentalType: 'ShortTerm',
          isActive: true,
          createdAt: '2026-01-01T00:00:00Z',
          orgId: 'org-target',
          orgName: 'Target Org',
          planTier: 'Starter',
        };
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [user], totalCount: 1, page: 1, pageSize: 20 }) });
      });
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(demoUrl('/app/admin/users', 'admin'));
      await page.getByRole('button', { name: 'Piano' }).click();

      const dialog = page.getByRole('dialog');
      const cards = ['Starter', 'Pro', 'Scale'].map((tier) => dialog.getByTestId(`plan-card-${tier}`));
      await expect(cards[2]).toBeVisible();
      expect(await linesOf(cards[1].locator('p').first())).toBeGreaterThanOrEqual(3);
      expect(await linesOf(cards[0].locator('p').first())).toBe(1);

      await expectAligned(cards.map((card) => card.locator('h3')), 'name');
      await expectAligned(cards.map((card) => card.locator('p').nth(1)), 'limit');
      await expectAligned(cards.map((card) => card.getByRole('button')), 'button');
      await expectAligned(cards, 'card', 'bottom');
    });
  });

  test.describe('Hub of the guides (public SEO pages)', () => {
    test('the icon and the title of two cards of a row start at the same height when one title takes more lines', async ({ page }) => {
      await page.route('**/api/public/content', async (route) => {
        if (route.request().method() !== 'GET') {
          await route.fallback();
          return;
        }
        const guide = (slug: string, comuneName: string, title: string) => ({
          pageType: 'ComplianceGuide',
          title,
          comuneName,
          regionSlug: 'lombardia',
          comuneSlug: slug,
          path: `/p/affitti-brevi/lombardia/${slug}`,
        });
        const pages = [
          guide('como', 'Como', 'Affitti brevi a Como: CIN, Alloggiati Web e imposta di soggiorno, la guida completa per gli host'),
          guide('lecco', 'Lecco', 'Affitti brevi a Lecco'),
        ];
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ canonicalUrl: null, pages }) });
      });
      await page.setViewportSize({ width: 800, height: 900 });
      await page.goto('/p/affitti-brevi');

      const cards = page.getByTestId('seo-hub-guides').locator('li');
      await expect(cards).toHaveCount(2);
      expect(await linesOf(cards.nth(0).locator('a'))).toBeGreaterThanOrEqual(3);
      expect(await linesOf(cards.nth(1).locator('a'))).toBe(1);

      await expectAligned([0, 1].map((index) => cards.nth(index).locator('span[aria-hidden]')), 'icon');
      await expectAligned([0, 1].map((index) => cards.nth(index).locator('a')), 'title');
    });
  });

  test.describe('Invite QR codes of the admin', () => {
    test('the code, the address and the buttons of the two cards start at the same height', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(demoUrl('/app/admin/invite-qr', 'admin'));

      const cards = [page.getByTestId('qr-supplier'), page.getByTestId('qr-host')];
      await expect(cards[1].getByTestId('qr-host-image')).toBeVisible();
      await expectAligned(cards.map((card) => card.locator('h3')), 'title');
      await expectAligned(cards.map((card) => card.locator('img')), 'code');
      await expectAligned(cards.map((card) => card.locator('p[data-testid$="-url"]')), 'address');
      // The address of the host is on two lines (it carries the campaign, a long one here), the one of the supplier on one.
      await page.getByTestId('qr-campaign-input').fill('campagna-di-autunno-per-i-nuovi-host-del-lago');
      await expect(cards[1].getByTestId('qr-host-url')).toContainText('campagna-di-autunno');
      expect(await linesOf(cards[1].getByTestId('qr-host-url'))).toBeGreaterThan(await linesOf(cards[0].getByTestId('qr-supplier-url')));
      await expectAligned(cards.map((card) => card.getByRole('button').first()), 'buttons');
      await expectAligned(cards, 'card', 'bottom');
    });
  });

  test.describe('OTA channels (behind the otaPartnerApi flag)', () => {
    test('the rows and the button of the cards line up whichever optional rows a channel has', async ({ page }) => {
      await page.route('**/api/public/features', async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ otaPartnerApi: true }) });
      });
      await page.route(/\/api\/ota(\?.*)?$/, async (route) => {
        if (route.request().method() !== 'GET') {
          await route.fallback();
          return;
        }
        const integration = (platform: string, extra: Record<string, unknown>) => ({
          id: `ota-${platform}`,
          platform,
          propertyId: 'p1',
          credentials: {},
          isActive: true,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
          ...extra,
        });
        // One has a sync status, one has a status and an error, one is not connected and has neither.
        const channels = [
          integration('AIRBNB', { lastSyncStatus: 'COMPLETED', lastSyncAt: new Date(Date.now() - 12 * 60_000).toISOString() }),
          integration('BOOKING_COM', {
            lastSyncStatus: 'FAILED',
            lastSyncAt: new Date(Date.now() - 300 * 60_000).toISOString(),
            syncError: 'Il portale ha risposto 401: le credenziali non sono più valide, aggiornale e riprova.',
          }),
          integration('EXPEDIA', { isActive: false }),
        ];
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(channels) });
      });
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(demoUrl('/app/short-rent/ota', 'short-stay'));

      const cards = page.locator('div.grid > div.rounded-lg.border').filter({ has: page.getByRole('button') });
      await expect(cards).toHaveCount(3);
      const each = (selector: string) => [0, 1, 2].map((index) => cards.nth(index).locator(selector).first());
      await expectAligned(each('h3'), 'name');
      await expectAligned(each('button'), 'button');
      await expectAligned(each('button'), 'button', 'bottom');
      // "Ultima sync" is under the sync status in the cards that have one, and at the same height in the one that has not.
      await expectAligned(
        [0, 1, 2].map((index) => cards.nth(index).getByText('Ultima sync', { exact: true })),
        'last sync',
      );
      await expectAligned([0, 1, 2].map((index) => cards.nth(index)), 'card', 'bottom');
    });
  });

  test.describe('Marketplace: the suppliers of a property', () => {
    const PROPERTY_ID = 'prop-marketplace-aligned';

    async function mockMarketplace(page: Page): Promise<void> {
      await mockPropertiesApi(page, [buildCreatedProperty({ id: PROPERTY_ID, name: 'Casa Marketplace', city: 'H501' })]);
      await mockCurrentUserWithOrg(page);
      await mockEntitlement(page);
      await mockServiceCategoriesApi(page);
      await page.route('**/api/suppliers**', async (route) => {
        const url = new URL(route.request().url());
        if (!url.pathname.startsWith('/api/') || route.request().method() !== 'GET') {
          await route.fallback();
          return;
        }
        const supplier = (n: number, legalName: string, categories: string[], bio?: string) => ({
          orgId: `sup-org-${n}`,
          legalName,
          phone: '+39 06 111111',
          email: `info${n}@fornitore.test`,
          categories,
          comuni: ['H501'],
          bio,
          photoUrls: [],
        });
        const items =
          url.searchParams.get('propertyId') === PROPERTY_ID
            ? [
                supplier(1, 'Servizi Integrati di Pulizia e Manutenzione per Strutture Ricettive del Lago di Como S.r.l.', ['cleaning', 'maintenance', 'plumbing', 'laundry'], 'Pulizie professionali, manutenzione ordinaria e straordinaria.'),
                supplier(2, 'Pulizie Express Srl', ['cleaning']),
              ]
            : [];
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items, totalCount: items.length, page: 1, pageSize: items.length }) });
      });
    }

    test('the badges of two suppliers of a row start at the same height whatever the length of their names', async ({ page }) => {
      await mockMarketplace(page);
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(demoUrl(`/app/short-rent/marketplace?propertyId=${PROPERTY_ID}`, 'short-stay'));

      const cards = page.getByTestId('marketplace-supplier-grid').locator('> div');
      await expect(cards).toHaveCount(2);
      // The first name is on three lines, the second on one; only the first supplier has a bio.
      expect(await linesOf(cards.nth(0).locator('.font-medium').first())).toBeGreaterThanOrEqual(3);
      expect(await linesOf(cards.nth(1).locator('.font-medium').first())).toBe(1);

      await expectAligned([0, 1].map((index) => cards.nth(index).locator('.flex-wrap')), 'badges');
      await expectAligned([0, 1].map((index) => cards.nth(index)), 'card', 'bottom');
      // The badge of the second one keeps its own size (a flex line that grows with its row would stretch it).
      const [tall, short] = await Promise.all([cards.nth(0).locator('.flex-wrap > *').first().boundingBox(), cards.nth(1).locator('.flex-wrap > *').first().boundingBox()]);
      expect(Math.abs(short!.height - tall!.height)).toBeLessThanOrEqual(1);
    });
  });

  test.describe('Menu of the phone (the sheet "Altro")', () => {
    test('the two tiles of a row are as tall as each other when a name takes two lines', async ({ page }) => {
      // A narrow phone: "Sito di prenotazione" is on two lines, "Marketplace" next to it on one.
      await page.setViewportSize({ width: 320, height: 800 });
      await page.goto(demoUrl('/app/short-rent', 'short-stay'));
      await page.locator('[data-more-trigger]').click();
      const sheet = page.getByRole('dialog', { name: 'Altro' });
      await expect(sheet.getByRole('link', { name: 'Marketplace' })).toBeVisible();

      // One pass in the page, because the sheet slides in while the boxes are read.
      const tiles = await sheet.locator('ul > li > a').evaluateAll((nodes) => {
        const top = nodes[0].getBoundingClientRect().top;
        return nodes.map((node) => {
          const box = node.getBoundingClientRect();
          return { row: Math.round(box.top - top), height: Math.round(box.height), name: node.textContent ?? '' };
        });
      });
      expect(new Set(tiles.map((tile) => tile.height)).size, 'some tile is taller than the others').toBeGreaterThan(1);
      const rows = new Map<number, { height: number; name: string }[]>();
      for (const tile of tiles) rows.set(tile.row, [...(rows.get(tile.row) ?? []), tile]);
      for (const [row, inRow] of rows) {
        expect(new Set(inRow.map((tile) => tile.height)).size, `row at ${row}: ${inRow.map((tile) => `${tile.name} ${tile.height}`).join(', ')}`).toBe(1);
      }
    });
  });

  test.describe('Numbers (StatStrip)', () => {
    test('the numbers of a strip start at the same height whatever the length of their names', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto('/dev/calm-blocks');

      // "Prenotazioni in arrivo" and its chevron are on more lines than the first name: its number used to be lower than the others.
      const strip = page.getByTestId('strip-4');
      const tiles = strip.getByRole('listitem');
      await expect(tiles).toHaveCount(4);
      expect(await linesOf(tiles.nth(1).locator('span.flex > span.min-w-0'))).toBeGreaterThan(
        await linesOf(tiles.nth(0).locator('span.flex > span.min-w-0')),
      );

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
      // A laptop with the sidebar open: each of the four columns is about 170 px.
      await page.setViewportSize({ width: 1040, height: 900 });
      await page.goto(demoUrl('/app/short-rent', 'short-stay'));

      const numbers = page.getByTestId('home-numbers');
      const tiles = numbers.getByRole('listitem').filter({ has: page.locator('.text-2xl') });
      await expect(tiles).toHaveCount(3);
      await expect(numbers.getByTestId('home-next-arrivals')).toBeVisible();
      // Whether "Prenotazioni in arrivo" fits on one line at 170 px depends on the font, so the third name is made long on purpose.
      const names = [0, 1, 2].map((index) => tiles.nth(index).locator('span.flex > span.min-w-0'));
      await setText(names[2], 'Prenotazioni in arrivo e da confermare');
      expect(await linesOf(names[2])).toBeGreaterThan(await linesOf(names[0]));

      await expectAligned([0, 1, 2].map((index) => tiles.nth(index).locator('span.flex')), 'name');
      await expectAligned([0, 1, 2].map((index) => tiles.nth(index).locator('.text-2xl')), 'number');
      // The list of arrivals is not made of those rows: it starts at the top, at the height of the names, and does not make them taller.
      await expectAligned([tiles.nth(0).locator('span.flex'), numbers.getByTestId('home-next-arrivals').locator('p').first()], 'name and list title');
      const [name, value, list, ...all] = await Promise.all([
        tiles.nth(0).locator('span.flex').boundingBox(),
        tiles.nth(0).locator('.text-2xl').boundingBox(),
        numbers.getByTestId('home-next-arrivals').boundingBox(),
        ...[0, 1, 2].map((index) => tiles.nth(index).locator('span.flex').boundingBox()),
      ]);
      const tallest = Math.max(...all.map((box) => box!.height));
      expect(list!.height, 'the list of arrivals is taller than the longest name, or this proves nothing').toBeGreaterThan(tallest + 40);
      expect(value!.y - name!.y, 'the number is right under the longest name, not pushed down by the list').toBeLessThanOrEqual(tallest + 8);
    });
  });

  test.describe('Public site (src/site)', () => {
    // The site has its own stylesheet, which finds its classes by scanning src/site/ only: a class written anywhere else would
    // not be there, and the cards would not line up. So this is checked on the page, not only on the markup.

    /**
     * The dev server serves the template of a page, not the prerendered page: it is given the root element that the browser entry
     * of the site renders into (as `scripts/prerender-site.mjs` does at build time).
     */
    async function openSitePage(page: Page, id: 'home' | 'features' | 'suppliers'): Promise<void> {
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

      // The titles are made as different as can be, whatever the font and the copy: a word on one line, a sentence on several.
      await setText(each('h3')[0], 'Host');
      await setText(each('h3')[2], 'Proprietari di affitti lunghi, con tanti contratti e inquilini da seguire');
      expect(await linesOf(each('h3')[2])).toBeGreaterThan(await linesOf(each('h3')[0]));

      await expectAligned(each('h3'), 'title');
      await expectAligned(each('p'), 'text');
      await expectAligned([0, 1, 2, 3].map((index) => cards.nth(index)), 'card', 'bottom');
    });

    test('the cards of the features page start their lists at the same height', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await openSitePage(page, 'features');

      const cards = page.locator('div.grid > div:has(> h2)');
      await expect(cards).toHaveCount(7);
      // The first row: the text of the first card is made long and the one of the third short (on how many lines the copy wraps
      // depends on the font), so that the lists below them can only line up if the cards are rows of the same grid.
      const firstRow = [0, 1, 2].map((index) => cards.nth(index));
      await setText(firstRow[0].locator('p').first(), 'Un testo lungo, scritto apposta per occupare più righe di quello della terza scheda e di quello della seconda.');
      await setText(firstRow[2].locator('p').first(), 'Breve.');
      expect(await linesOf(firstRow[0].locator('p').first())).toBeGreaterThan(await linesOf(firstRow[2].locator('p').first()));

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

    test('five cards are five across from a laptop, not three and two with empty cells', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await openSitePage(page, 'home');

      const cards = cardsUnder(page, 'Adempimenti italiani sotto controllo');
      await expect(cards).toHaveCount(5);
      const all = [0, 1, 2, 3, 4].map((index) => cards.nth(index));
      await expectAligned(all, 'card');
      await expectAligned(
        all.map((card) => card.locator('h3')),
        'title',
      );
      await expectAligned(
        all.map((card) => card.locator('p')),
        'text',
      );
      await expectAligned(all, 'card', 'bottom');
    });

    test('three cards are three across from a tablet', async ({ page }) => {
      await page.setViewportSize({ width: 800, height: 900 });
      await openSitePage(page, 'suppliers');

      const cards = cardsUnder(page, 'Cosa trovi');
      await expect(cards).toHaveCount(3);
      await expectAligned([0, 1, 2].map((index) => cards.nth(index)), 'card');
      await expectAligned([0, 1, 2].map((index) => cards.nth(index).locator('p')), 'text');
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
